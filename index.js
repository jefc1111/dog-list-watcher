require('dotenv').config();

const chromium = require("@sparticuz/chromium")
const puppeteer = require("puppeteer-core")
const fs = require("fs").promises;
const nodemailer = require("nodemailer");
const { dogSites } = require('./site-list.private.js');

const DOG_LIST_DIR = process.env.DOG_LIST_DIR;
const EMAIL_SERVICE = process.env.EMAIL_SERVICE;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;

const transporter = nodemailer.createTransport({
  service: EMAIL_SERVICE,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

const setup = async (isLocal) => {
  const browser = await puppeteer.launch({
    args: isLocal ? [] : chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: isLocal ? "/usr/bin/brave" : await chromium.executablePath(),
    headless: isLocal ? false : chromium.headless,
    ignoreHTTPSErrors: true,
  });
  
  const page = await browser.newPage();
  
  return [
    browser,
    page
  ]
}

// --- Local File Configuration ---
const getFilePath = (siteId) => `${DOG_LIST_DIR}/last_seen_dogs_${siteId}.json`;

const sendChangeNotification = async (changes, dogSite) => {
  const hasChanges = Object.values(changes).some(category => category.length > 0);

  if (!hasChanges) {
    console.log('No changes detected. Skipping email notification.');
    return;
  }

  // Build the email content
  let emailBody = 'The following changes were detected on the adoptions page:\n\n';

  const changeCategories = {
    'New Entries': {
      data: changes.newEntries,
      formatter: dog => `${dog.name} - ${dog.url}`
    },
    'Removed Entries': {
      data: changes.removed,
      formatter: dog => dog.name
    },
    'Became Reserved': {
      data: changes.becameReserved,
      formatter: dog => dog.name
    },
    'No Longer Reserved': {
      data: changes.noLongerReserved,
      formatter: dog => dog.name
    }
  };

  for (const [title, category] of Object.entries(changeCategories)) {
    if (category.data.length > 0) {
      emailBody += `--- ${title} ---\n`;
      category.data.forEach(dog => {
        emailBody += `${category.formatter(dog)}\n`;
      });
      emailBody += '\n';
    }
  }
  
  const mailOptions = {
    from: EMAIL_USER, // ⚠️ Replace with your email
    to: EMAIL_RECIPIENT, // ⚠️ Replace with the recipient email
    subject: `🐕 ${dogSite.name} - Change Notification`,
    text: emailBody,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email notification sent successfully!');
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

// --- Helper Functions for File System Interaction ---
const readLastSeenDogs = async (dogSite) => {
  try {
    const data = await fs.readFile(getFilePath(dogSite.id), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No previous state file found. Might be the first run.');
      return [];
    }
    console.error('Error reading file:', error);
    throw error;
  }
}

const saveCurrentDogs = async (dogs, dogSite) => {
  try {
    await fs.writeFile(getFilePath(dogSite.id), JSON.stringify(dogs, null, 2));
    console.log('Successfully saved current dog list to local file.');
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
}

const doChangeDetection = async (previousDogs, currentDogs, dogSite) => {
    const lastSeenMap = new Map(previousDogs.map(dog => [dog.name.replace('– RESERVED', '').trim(), dog]));
    const currentMap = new Map(currentDogs.map(dog => [dog.name.replace('– RESERVED', '').trim(), dog]));

    const changes = {
      newEntries: [],
      removed: [],
      becameReserved: [],
      noLongerReserved: [],
    };

    // Check for new entries and became reserved
    for (const [nameKey, currentDog] of currentMap) {
      const lastSeenDog = lastSeenMap.get(nameKey);
      
      if (!lastSeenDog) {
        changes.newEntries.push(currentDog);
      } else {
        const wasReserved = lastSeenDog.name.includes('– RESERVED');
        const isReserved = currentDog.name.includes('– RESERVED');

        if (!wasReserved && isReserved) {
          changes.becameReserved.push(currentDog);
        }
      }
    }

    // Check for removed and no longer reserved
    for (const [nameKey, lastSeenDog] of lastSeenMap) {
      const currentDog = currentMap.get(nameKey);

      if (!currentDog) {
        changes.removed.push(lastSeenDog);
      } else {
        const wasReserved = lastSeenDog.name.includes('– RESERVED');
        const isReserved = currentDog.name.includes('– RESERVED');
        
        if (wasReserved && !isReserved) {
          changes.noLongerReserved.push(currentDog);
        }
      }
    }

    const dateStr = new Date().toLocaleString();

    // 4. Log the detected changes
    console.log(`\n--- Change Report for ${dogSite.name} (${dateStr}) ---`);

    const changeCategories = {
      'New Entries': {
        data: changes.newEntries,
        prefix: 'Added:',
        message: 'New Entries:'
      },
      'Removed': {
        data: changes.removed,
        prefix: 'Removed:',
        message: 'Removed:'
      },
      'Became Reserved': {
        data: changes.becameReserved,
        prefix: 'Now reserved:',
        message: 'Became Reserved:'
      },
      'No Longer Reserved': {
        data: changes.noLongerReserved,
        prefix: 'No longer reserved:',
        message: 'No Longer Reserved:'
      }
    };

    for (const category of Object.values(changeCategories)) {
      console.log(`${category.message} ${category.data.length}`);

      category.data.forEach(dog => console.log(`- ${category.prefix} ${dog.name}`));
    }

    return changes;
}

/* -------------------------------------------------------------------------------------------- */

const scrapeSites = async (isLocal = false) => {
  for (const dogSite of dogSites) {
    const [ browser, page ] = await setup(isLocal);

    try {
      const lastSeenDogs = await readLastSeenDogs(dogSite);

      const currentDogs = await getCurrentDogs(page, dogSite);

      const changes = await doChangeDetection(lastSeenDogs, currentDogs, dogSite);

      await saveCurrentDogs(currentDogs, dogSite);

      await sendChangeNotification(changes, dogSite);
    } catch (error) {
      console.error('An error occurred:', error);
    } finally {
      await browser.close();
    }
  }
}

const getCurrentDogs = async (page, dogSite) => {
  // Navigate to the adoptions page
  await page.goto(dogSite.url);
  
  // Wait for the dog listings to load. Adjust the selector if needed.
  await page.waitForSelector(dogSite.cardSelector);

  // Get the list of all dog listings
  const currentDogs = await page.$$eval(dogSite.cardSelector, (listings, dogSite) => {
        // Map each listing element to an object containing the dog's name and other details
    return listings.map(listing => {
      const nameElement = listing.querySelector(dogSite.nameSelector);
      const urlElement = listing.querySelector(dogSite.urlSelector);

      const name = nameElement ? nameElement.innerText.trim() : 'Name not found';
      const url = urlElement ? urlElement.href.trim() : 'URL not found';

      return { name, url };
    });
  }, dogSite);

  return currentDogs;
}

exports.scrapeSites = scrapeSites;

