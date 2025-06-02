const cron = require('node-cron');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const PdfPrinter = require('pdfmake');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Define fonts for pdfmake (Node.js)
// Make sure these font files exist on your server in the specified paths
const fonts = {
  Roboto: {
    normal: 'server/fonts/Roboto-Regular.ttf',
    bold: 'server/fonts/Roboto-Medium.ttf',
    italics: 'server/fonts/Roboto-Italic.ttf',
    bolditalics: 'server/fonts/Roboto-MediumItalic.ttf'
  }
  // Add other fonts if needed, e.g.:
  // OpenSans: {
  //   normal: 'path/to/OpenSans-Regular.ttf',
  //   bold: 'path/to/OpenSans-Bold.ttf',
  //   italics: 'path/to/OpenSans-Italic.ttf',
  //   bolditalics: 'path/to/OpenSans-BoldItalic.ttf'
  // }
};

const printer = new PdfPrinter(fonts);

// Email configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    secure: true,
    port: 465
  });
};

// Helper function to calculate start and end dates for the previous month in UTC
const getPreviousMonthDateRange = () => {
  const now = new Date();
  const currentYearUTC = now.getUTCFullYear();
  const currentMonthUTC = now.getUTCMonth(); // 0-11

  // Calculate previous month and year in UTC
  let previousMonthUTC = currentMonthUTC - 1;
  let previousYearUTC = currentYearUTC;
  if (previousMonthUTC < 0) {
    previousMonthUTC = 11; // December
    previousYearUTC--;
  }

  // Calculate start and end dates for the previous month in UTC
  const previousMonthStart = new Date(Date.UTC(previousYearUTC, previousMonthUTC, 1, 0, 0, 0));
  const previousMonthEnd = new Date(Date.UTC(currentYearUTC, currentMonthUTC, 1, 0, 0, 0)); // Start of the current month in UTC

  // Determine the report month and year based on India time (Asia/Kolkata) for reporting purposes
  const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  let reportMonth = nowIST.getMonth() - 1;
  let reportYear = nowIST.getFullYear();

  if (reportMonth < 0) {
      reportMonth = 11; // December
      reportYear--;
  }

  return { previousMonthStart, previousMonthEnd, month: reportMonth, year: reportYear };
};

// Helper function to generate PDF document definition
const generateReportDocumentDefinition = (user, transactions, totalIncome, totalExpense, netBalance, month, year) => {
  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[month];

  const documentDefinition = {
    content: [
      // Header
      {
        columns: [
          // You might want to add your logo here if you have it server-side
          // { image: 'logo_base64_encoded', width: 50, height: 50, style: 'logo' },
          {
            stack: [
              { text: 'Monthly Financial Report', style: 'header' },
              { text: `For ${user.name}`, style: 'subheader' },
              { text: `Email: ${user.email}`, style: 'reportInfo' },
            ],
            width: '*'
          },
          {
            stack: [
               { text: `Report Period: ${monthName} ${year}`, style: 'reportInfo', alignment: 'right' },
               { text: `Generated On: ${new Date().toLocaleDateString()}`, style: 'reportInfo', alignment: 'right' },
            ],
             width: 'auto'
          }
        ],
        margin: [0, 0, 0, 20]
      },

      // Summary
      { text: 'Summary', style: 'sectionHeader' },
      {
        columns: [
          {
            stack: [
              { text: 'Total Income', style: 'summaryLabel' },
              { text: `$${totalIncome.toFixed(2)}`, style: 'summaryValue', color: 'green' },
            ],
            width: '30%', alignment: 'center'
          },
          {
             stack: [
              { text: 'Total Expense', style: 'summaryLabel' },
              { text: `$${totalExpense.toFixed(2)}`, style: 'summaryValue', color: 'red' },
            ],
            width: '30%', alignment: 'center'
          },
          {
             stack: [
              { text: 'Net Balance', style: 'summaryLabel' },
              { text: `$${netBalance.toFixed(2)}`, style: 'summaryValue', color: netBalance >= 0 ? 'green' : 'red' },
            ],
            width: '30%', alignment: 'center'
          }
        ],
         columnGap: 10,
         margin: [0, 0, 0, 20]
      },

      // Transactions
      { text: 'Transactions', style: 'sectionHeader' },
      {
        table: {
          widths: ['15%', '35%', '20%', '15%', '15%'],
          body: [
            // Table Header
            [
              { text: 'Date', style: 'tableHeader' },
              { text: 'Description', style: 'tableHeader' },
              { text: 'Category', style: 'tableHeader' },
              { text: 'Type', style: 'tableHeader' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' }
            ],
            // Table Rows
            ...transactions.map(t => [
              { text: new Date(t.date).toLocaleDateString(), style: 'tableCell' },
              { text: t.description || '-', style: 'tableCell' },
              { text: t.category, style: 'tableCell' },
              { text: t.type.charAt(0).toUpperCase() + t.type.slice(1), style: 'tableCell' },
              { text: `$${t.amount.toFixed(2)}`, style: 'tableCell', alignment: 'right' }
            ]),
          ]
        },
        layout: {
          hLineWidth: function (i, node) { return (i === 0 || i === node.table.body.length) ? 1 : 0.5; },
          vLineWidth: function (i, node) { return (i === 0 || i === node.table.widths.length) ? 1 : 0.5; },
          hLineColor: function (i, node) { return (i === 0 || i === node.table.body.length) ? '#000' : '#aaa'; },
          vLineColor: function (i, node) { return (i === 0 || i === node.table.widths.length) ? '#000' : '#aaa'; },
          paddingLeft: function(i, node) { return 4; },
          paddingRight: function(i, node) { return 4; },
          paddingTop: function(i, node) { return 2; },
          paddingBottom: function(i, node) { return 2; },
        }
      }
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 5],
        color: '#0F172A' // Slate-900
      },
      subheader: {
        fontSize: 14,
        bold: true,
        margin: [0, 0, 0, 2],
        color: '#0F172A' // Slate-900
      },
      reportInfo: {
         fontSize: 10,
         color: '#475569', // Slate-600
         margin: [0, 2, 0, 2]
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        margin: [0, 15, 0, 10],
        color: '#0F172A', // Slate-900
        decoration: 'underline'
      },
      summaryLabel: {
         fontSize: 10,
         color: '#475569', // Slate-600
         marginBottom: 4,
         bold: true
      },
       summaryValue: {
        fontSize: 14,
        bold: true,
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
        fillColor: '#34D399', // Green-500
        color: '#FFFFFF', // White
        alignment: 'left',
        margin: [0, 2, 0, 2]
      },
       tableCell: {
        fontSize: 8,
        margin: [0, 2, 0, 2]
      }
    }
  };

  return documentDefinition;
};

// Helper function to send email with attachment
const sendReportEmail = async (userEmail, monthName, year, pdfDoc) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email service not configured. Skipping email for', userEmail);
    return;
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: `Monthly Financial Report - ${monthName} ${year}`,
    text: `Please find your monthly financial report for ${monthName} ${year} attached.`,
    attachments: [{
      filename: `Financial_Report_${monthName}_${year}.pdf`,
      content: pdfDoc,
      contentType: 'application/pdf'
    }]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent to %s: %s', userEmail, info.messageId);
  } catch (error) {
    console.error('Error sending email to', userEmail, ':', error);
  }
};

// Helper function to check if today is the last day of the month
const isLastDayOfMonth = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return tomorrow.getMonth() !== now.getMonth();
};

// Schedule the cron job to run on the 28th, 29th, 30th, or 31st of every month at midnight
// Temporarily changed to run 1 minute from now for testing
const now = new Date();
const testMinute = now.getMinutes() + 1;
const testHour = now.getHours();
const testDay = now.getDate();
const testMonth = now.getMonth() + 1; // getMonth() is 0-indexed
const testYear = now.getFullYear();

const testSchedule = `${testMinute} ${testHour} ${testDay} ${testMonth} *`;

cron.schedule(testSchedule, async () => {
  console.log('Running monthly report cron job (test run)...');

  // In a real run, we would check if it's the last day of the month:
  // if (!isLastDayOfMonth()) {
  //   console.log('Today is not the last day of the month. Skipping report generation.');
  //   return;
  // }

  console.log('Generating reports for test run...');

  try {
    // Find all users
    const users = await User.find({});
    // Temporarily override date range to include transactions up to now for testing
    const now = new Date();
    const currentYearUTC = now.getUTCFullYear();
    const currentMonthUTC = now.getUTCMonth();
    
    const previousMonthStart = new Date(Date.UTC(currentYearUTC, currentMonthUTC, 1, 0, 0, 0)); // Start of current month UTC
    const previousMonthEnd = now; // Up to current time UTC

    // Use current month/year for reporting purposes in test
    const reportMonth = now.getMonth();
    const reportYear = now.getFullYear();
    
    console.log(`Fetching transactions for test period: ${previousMonthStart.toISOString()} to ${previousMonthEnd.toISOString()}`);

    for (const user of users) {
      console.log(`Processing data for user: ${user.email}`);

      // 1. Fetch user\'s transactions for the previous month
      const transactions = await Transaction.find({
        userId: user._id,
        date: {
          $gte: previousMonthStart,
          $lt: previousMonthEnd
        }
      }).sort({ date: 1 }); // Sort by date

      // 2. Calculate income, expenses, and net balance
      let totalIncome = 0;
      let totalExpense = 0;

      transactions.forEach(transaction => {
        if (transaction.type === 'income') {
          totalIncome += transaction.amount;
        } else if (transaction.type === 'expense') {
          totalExpense += transaction.amount;
        }
      });

      const netBalance = totalIncome - totalExpense;

      console.log(`  Income: ${totalIncome.toFixed(2)}, Expense: ${totalExpense.toFixed(2)}, Net Balance: ${netBalance.toFixed(2)}`);

      // Only generate and send report if there are transactions or a non-zero balance
      if (transactions.length > 0 || totalIncome !== 0 || totalExpense !== 0) {
         // 3. Generate PDF report
        const documentDefinition = generateReportDocumentDefinition(
          user,
          transactions,
          totalIncome,
          totalExpense,
          netBalance,
          reportMonth,
          reportYear
        );

        const pdfDoc = printer.createPdfKitDocument(documentDefinition);

        // Convert PDF document to a buffer
        const chunks = [];
        pdfDoc.on('data', (chunk) => chunks.push(chunk));
        pdfDoc.on('end', async () => {
          const pdfBuffer = Buffer.concat(chunks);
          const monthNames = ["January", "February", "March", "April", "May", "June",
                              "July", "August", "September", "October", "November", "December"];
          const monthName = monthNames[reportMonth];

          // 4. Send email with PDF attachment
          await sendReportEmail(user.email, monthName, reportYear, pdfBuffer);
        });
        pdfDoc.end();

      } else {
        console.log(`  No relevant financial activity found for ${user.email} in the previous month. Skipping report.`);
      }
    }

    console.log('Monthly report cron job finished.');
  } catch (error) {
    console.error('Error running monthly report cron job:', error);
  }
});

console.log('Monthly report cron job scheduled.'); 