
exports.up = async function (knex) {
  // Enable UUID generation
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  // 1. Financial accounts
  await knex.schema.createTable('accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable();
    table.string('account_type', 40).notNullable();
    table.string('account_name', 100).notNullable();
    table.string('currency', 3).notNullable().defaultTo('NGN');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['user_id']);
    table.index(['account_type']);
  });

  // 2. Financial transactions
  await knex.schema.createTable('wallet_transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('reference', 100).notNullable().unique();
    table.string('transaction_type', 50).notNullable();
    table.string('status', 30).notNullable().defaultTo('PENDING');
    table.bigInteger('amount_kobo').notNullable();
    table.string('currency', 3).notNullable().defaultTo('NGN');
    table.text('description').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['transaction_type']);
    table.index(['status']);
  });

  // 3. Double-entry ledger
  await knex.schema.createTable('ledger_entries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.uuid('transaction_id')
      .notNullable()
      .references('id')
      .inTable('wallet_transactions');

    table.uuid('account_id')
      .notNullable()
      .references('id')
      .inTable('accounts');

    table.string('entry_type', 10).notNullable();
    table.bigInteger('amount_kobo').notNullable();

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['transaction_id']);
    table.index(['account_id']);
  });

  // Database-level financial constraints
  await knex.raw(`
    ALTER TABLE wallet_transactions
    ADD CONSTRAINT wallet_transactions_positive_amount
    CHECK (amount_kobo > 0)
  `);

  await knex.raw(`
    ALTER TABLE ledger_entries
    ADD CONSTRAINT ledger_entries_positive_amount
    CHECK (amount_kobo > 0),
    ADD CONSTRAINT ledger_entries_valid_type
    CHECK (entry_type IN ('DEBIT', 'CREDIT'))
  `);

  await knex.raw(`
    CREATE FUNCTION prevent_ledger_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Ledger entries cannot be modified or deleted';
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    CREATE TRIGGER immutable_ledger_entries
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION prevent_ledger_modification();
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TRIGGER IF EXISTS immutable_ledger_entries ON ledger_entries');
  await knex.raw('DROP FUNCTION IF EXISTS prevent_ledger_modification()');

  await knex.schema.dropTableIfExists('ledger_entries');
  await knex.schema.dropTableIfExists('wallet_transactions');
  await knex.schema.dropTableIfExists('accounts');
};
