
require('dotenv').config();

const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig.development);

const systemAccounts = [
  {
    account_type: 'SYSTEM',
    account_name: 'PLATFORM_ESCROW',
    currency: 'NGN',
  },
  {
    account_type: 'SYSTEM',
    account_name: 'PLATFORM_REVENUE',
    currency: 'NGN',
  },
  {
    account_type: 'SYSTEM',
    account_name: 'PLATFORM_PAYOUT_CLEARING',
    currency: 'NGN',
  },
];

const seed = async () => {
  try {
    console.log('Starting KoboMarket database seeding...');

    await knex.transaction(async (trx) => {
      for (const account of systemAccounts) {
        const existingAccount = await trx('accounts')
          .where({
            account_type: account.account_type,
            account_name: account.account_name,
            currency: account.currency,
            user_id: null,
          })
          .first();

        if (!existingAccount) {
          await trx('accounts').insert(account);
          console.log(`Created: ${account.account_name}`);
        } else {
          console.log(`Already exists: ${account.account_name}`);
        }
      }
    });

    console.log('Database seeding completed successfully.');
  } catch (error) {
    console.error('Database seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await knex.destroy();
  }
};

seed();
