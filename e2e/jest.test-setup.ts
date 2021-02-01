const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36';

/**
 * Set up page common properties:
 * - Page view port
 * - Page user-agent
 * - Page navigation timeout
 * - waitFor functions timeout
 */
beforeEach(async () => {

  await jestPuppeteer.resetPage();
  await jestPuppeteer.resetBrowser();

  await page.setUserAgent(userAgent);
  await page.setViewport({width: 1300, height: 0});

  page.setDefaultNavigationTimeout(60000); // Puppeteer default timeout is 30 seconds.
  page.setDefaultTimeout(30000);

  await page.setRequestInterception(true);

  page.on('request', (request) => {
    try {
      request.continue();
      // tslint:disable-next-line:no-empty
    } catch (e) {
    }
  });

  page.on('console', message => {
    if (message != null) {
      // Don't log "log", "info" or "debug"
      if (['ERROR', 'WARNING'].includes(message.type().toUpperCase())) {
        console.debug(`❗ Console Message: ${message.type()}: ${message.text()}`);
      }
    }
  });

  // Emitted when the page crashed
  page.on('error', error => {
    console.debug(`❗ Page Crashed: ${error}`);
  });

  // Emitted when a script has uncaught exception
  page.on('pageerror', error => {
    if (error != null) {
      console.debug(`❗ Page Error: ${error}`);
    }
  });

  // Emitted when a request failed. Warning: blocked requests from above will be logged as failed requests, safe to ignore these.
  page.on('requestfailed', async request => {
    try {
      const response = request.response();
      if (response !== null) {
        const status = response.status();
        const responseText = await response.text();
        const failureError = request.failure().errorText;
        console.debug(`❗ Failed Request: ${status} ${request.method()} ${request.url()}  \n ${failureError} \n ${responseText}`);
      }
      // tslint:disable-next-line:no-empty
    } catch (err) {
    }
  });

  page.on('response', async(response) => {
    try {
      const request = response.request();
      const requestUrl = request.url();

      // Long only responses from AoU-app requests
      if (requestUrl.includes('api-dot-all-of-us')) {
        const failure = request.failure();
        const method = request.method().trim();
        if (method !== 'OPTIONS') {
          if (failure !== null) {
            // This log sometimes duplicate log from requestfailed.
            console.debug(`❗ Failed Request: ${response.status()} ${method} ${requestUrl} \n ${failure.errorText}`);
          } else {
            console.debug(`❗ Request: ${response.status()} ${method} ${requestUrl}`);
          }
        }
      }
      // tslint:disable-next-line:no-empty
    } catch (err) {
    }
  });
  
});

afterEach(async () => {
  await page.setRequestInterception(false);
});
