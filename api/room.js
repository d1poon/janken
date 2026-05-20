const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS janken_rooms (
      id           TEXT PRIMARY KEY,
      player1_hand TEXT,
      player2_hand TEXT,
      status       TEXT NOT NULL DEFAULT 'waiting',
      created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at   TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
    )
  `;

  // 期限切れルームを削除
  await sql`DELETE FROM janken_rooms WHERE expires_at < NOW()`;

  const { id } = req.query;

  // ルーム作成
  if (req.method === 'POST') {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    await sql`INSERT INTO janken_rooms (id) VALUES (${roomId})`;
    return res.status(200).json({ id: roomId });
  }

  if (!id) return res.status(400).json({ error: 'id required' });

  // ルーム取得
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM janken_rooms WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    return res.status(200).json(rows[0]);
  }

  // 手の更新 or ラウンドリセット
  if (req.method === 'PATCH') {
    const { playerNum, hand, reset } = req.body;

    // ラウンドリセット（次の対戦へ）
    if (reset) {
      await sql`
        UPDATE janken_rooms
        SET player1_hand = NULL, player2_hand = NULL, status = 'ready'
        WHERE id = ${id}
      `;
      const rows = await sql`SELECT * FROM janken_rooms WHERE id = ${id}`;
      return res.status(200).json(rows[0]);
    }

    // 手の登録
    if (!['rock', 'scissors', 'paper'].includes(hand)) {
      return res.status(400).json({ error: 'invalid hand' });
    }

    if (playerNum === 1) {
      await sql`
        UPDATE janken_rooms
        SET player1_hand = ${hand}, status = 'playing'
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE janken_rooms
        SET player2_hand = ${hand}, status = 'playing'
        WHERE id = ${id}
      `;
    }

    // 両者揃ったら done に
    const rows = await sql`SELECT * FROM janken_rooms WHERE id = ${id}`;
    const room = rows[0];
    if (room.player1_hand && room.player2_hand) {
      await sql`UPDATE janken_rooms SET status = 'done' WHERE id = ${id}`;
      room.status = 'done';
    }

    return res.status(200).json(room);
  }

  res.status(405).end();
};
