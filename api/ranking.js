const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // テーブル初回作成
  await sql`
    CREATE TABLE IF NOT EXISTS janken_rankings (
      id         SERIAL PRIMARY KEY,
      score      INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT score,
             TO_CHAR(created_at AT TIME ZONE 'Asia/Tokyo', 'MM/DD') AS date
      FROM   janken_rankings
      ORDER  BY score DESC, created_at ASC
      LIMIT  5
    `;
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { score } = req.body;
    if (!Number.isInteger(score) || score < 1 || score > 9999) {
      return res.status(400).json({ error: 'invalid score' });
    }
    await sql`INSERT INTO janken_rankings (score) VALUES (${score})`;
    const rows = await sql`
      SELECT score,
             TO_CHAR(created_at AT TIME ZONE 'Asia/Tokyo', 'MM/DD') AS date
      FROM   janken_rankings
      ORDER  BY score DESC, created_at ASC
      LIMIT  5
    `;
    return res.status(200).json(rows);
  }

  res.status(405).end();
};
