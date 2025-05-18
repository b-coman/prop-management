import { updateAllPriceCalendars } from '../../lib/pricing/price-calendar-generator';

/**
 * This script updates price calendars for all active properties
 * It's designed to be run as a scheduled cron job (e.g., daily at midnight)
 */
async function main() {
  console.log('Starting price calendar update job...');
  
  try {
    // Default to generating 12 months of price calendars
    const numberOfMonths = 12;
    await updateAllPriceCalendars(numberOfMonths);
    console.log('Price calendar update job completed successfully');
  } catch (error) {
    console.error('Error in price calendar update job:', error);
    throw error; // Re-throw to ensure the process exits with error
  }
}

// Check if being run directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('Job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Job failed:', error);
      process.exit(1);
    });
}

export { main as updatePriceCalendarsJob };