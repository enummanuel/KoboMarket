
exports.up = async function (knex) {
  // 1. Main buyer orders
  await knex.schema.createTable('orders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // MongoDB user ID
    table.string('buyer_id', 64).notNullable();

    table.string('reference', 100).notNullable().unique();

    // Prevent duplicate checkout requests
    table.string('idempotency_key', 100).notNullable();

    table.bigInteger('total_amount_kobo').notNullable();

    table.string('currency', 3).notNullable().defaultTo('NGN');

    table.string('status', 30).notNullable().defaultTo('PENDING_PAYMENT');

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['buyer_id', 'idempotency_key']);
    table.index(['buyer_id']);
    table.index(['status']);
  });

  // 2. Vendor-specific sub-orders
  await knex.schema.createTable('sub_orders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.uuid('order_id')
      .notNullable()
      .references('id')
      .inTable('orders')
      .onDelete('RESTRICT');

    // MongoDB vendor ID
    table.string('vendor_id', 64).notNullable();

    table.bigInteger('subtotal_kobo').notNullable();

    table.bigInteger('commission_kobo').notNullable();

    table.bigInteger('vendor_amount_kobo').notNullable();

    table.string('status', 30).notNullable().defaultTo('PENDING_PAYMENT');

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['order_id', 'vendor_id']);
    table.index(['vendor_id']);
    table.index(['status']);
  });

  // 3. Escrow records
  await knex.schema.createTable('escrow_transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.uuid('sub_order_id')
      .notNullable()
      .references('id')
      .inTable('sub_orders')
      .onDelete('RESTRICT')
      .unique();

    // Gross amount held for this vendor's sub-order
    table.bigInteger('amount_kobo').notNullable();

    table.string('status', 30).notNullable().defaultTo('HELD');

    table.timestamp('held_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.timestamp('released_at', { useTz: true }).nullable();

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['status']);
  });

  // Financial validation constraints
  await knex.raw(`
    ALTER TABLE orders
    ADD CONSTRAINT orders_positive_total
    CHECK (total_amount_kobo > 0)
  `);

  await knex.raw(`
    ALTER TABLE sub_orders
    ADD CONSTRAINT sub_orders_valid_amounts
    CHECK (
      subtotal_kobo > 0
      AND commission_kobo >= 0
      AND vendor_amount_kobo >= 0
      AND subtotal_kobo = commission_kobo + vendor_amount_kobo
    )
  `);

  await knex.raw(`
    ALTER TABLE escrow_transactions
    ADD CONSTRAINT escrow_positive_amount
    CHECK (amount_kobo > 0)
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('escrow_transactions');
  await knex.schema.dropTableIfExists('sub_orders');
  await knex.schema.dropTableIfExists('orders');
};
