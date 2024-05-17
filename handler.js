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
    // Ensure the event body is parsed correctly
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (err) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Invalid JSON format in request body.",
        }),
      };
    }

    // Validate request body
    if (!requestBody || !requestBody.htmlContent) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "htmlContent is missing in the request body.",
        }),
      };
    }

    const htmlContent = requestBody.htmlContent;

    // Puppeteer configuration for AWS Lambda environment
    const puppeteerConfig = {
      executablePath: await chromium.executablePath,
      args: chromium.args,
      headless: chromium.headless,
    };

    // Launch Puppeteer browser and create PDF
    const browser = await puppeteer.launch(puppeteerConfig);
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pageWidth = 595; 
    const pageHeight = 842; 

    // // Adjust margins as needed
    // const margin = {
    //   top: "0.5cm",
    //   right: "0.5cm",
    //   bottom: "0.5cm",
    //   left: "0.5cm",
    // };

    const pdfBuffer = await page.pdf({
      width: `${pageWidth}px`,
      height: `${pageHeight}px`,
      printBackground: true,
      // margin,
    });

    await browser.close();

    // Generate unique S3 key for the PDF
    const s3Key = generateUniqueS3Key() + ".pdf";
    const s3Params = {
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      ContentDisposition: 'attachment; filename="generated.pdf"', // Force download with a specified filename
    };

    // Upload PDF to S3
    await s3.upload(s3Params).promise();
    const s3Url = `https://${s3Params.Bucket}.s3.amazonaws.com/${s3Params.Key}`;

    // Return success response
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

// Generate unique S3 key based on timestamp and random string
function generateUniqueS3Key() {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${randomString}`;
}
