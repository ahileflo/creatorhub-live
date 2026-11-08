import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

export async function createOrder({ email, tier, nColors, widthCm, heightCm, source }) {
  const { rows } = await pool.query(
    `INSERT INTO orders (customer_email, tier, n_colors, width_cm, height_cm, source)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [email, tier, nColors, widthCm, heightCm, source],
  );
  return rows[0].id;
}
