const puppeteer = require("puppeteer-core");
const chromium = require("chrome-aws-lambda");
const S3 = require("aws-sdk/clients/s3");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Origin": "*",
};

const s3 = new S3();

exports.generatePdfUrl = async (event) => {
  try {
    const requestBody = JSON.parse(event.body);

    if (!requestBody || !requestBody.htmlContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Input string is missing in the request body.",
        }),
      };
    }

    const htmlContent = requestBody.htmlContent;

    const puppeteerConfig = {
      executablePath: await chromium.executablePath,
      args: chromium.args,
      headless: chromium.headless,
    };

    const browser = await puppeteer.launch(puppeteerConfig);
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.5cm", right: "0.5cm", bottom: "0.5cm", left: "0.5cm" },
    });

    const params = {
      Bucket: process.env.S3_BUCKET, // Use environment variable for the S3 bucket
      Key: generateUniqueS3Key() + ".pdf",
      Body: pdf,
      ContentType: "application/pdf",
    };

    await s3.upload(params).promise();

    const s3Url = `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`;

    return {
      headers,
      statusCode: 200,
      body: JSON.stringify({
        message: "PDF generated successfully",
        pdfUrl: s3Url,
      }),
    };
  } catch (err) {
    console.error("Error processing request:", err);
    return {
      headers,
      statusCode: 500,
      body: JSON.stringify({
        error: "An error occurred while processing the request.",
      }),
    };
  }
};

function generateUniqueS3Key() {
  const timestamp = new Date().getTime();
  const randomString = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${randomString}`;
}
