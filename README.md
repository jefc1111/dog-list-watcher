# dog-list-watcher

This repo was spun up quickly to monitor a couple of dog shelter adoption list pages for changes.  

You'd need a `.env` and a `site-list.private.js` for it to work. See `.env.template` and a `site-list.template.js` for guidance. 

Also you would want to run it periodically. Each time it runs it compares to the previosuly saved list and emails the configured account if any changes are found. 

## Run locally

`npm run scrape-sites`

## Example cron cmd to run hourly

`0 * * * * cd /home/user/dog-list-watcher/ && /home/user/.nvm/versions/node/v20.14.0/bin/node scrape-sites.js >> /home/user/dog-list-watcher/log.txt 2>&1`

## Running in AWS

`sls deploy --aws-profile your-aws-profile`

- Create S3 bucket
- Set config vars
- Configure IAM Role

