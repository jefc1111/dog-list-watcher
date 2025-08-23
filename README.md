# dog-list-watcher

This repo was spun up quickly to monitor a couple of dog shelter adoption list pages for changes.  

You'd need a `.env` and a `site-list.private.js` for it to work. See `.env.template` and a `site-list.template.js` for guidance. 

Also you would want to run it periodically. Each time it runs it compares ot the previosuly saved list and emails the configured account if any changes are found. 