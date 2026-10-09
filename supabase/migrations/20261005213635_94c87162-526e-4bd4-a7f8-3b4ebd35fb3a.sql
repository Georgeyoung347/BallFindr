-- Versioned change: only the INSERT policy "Clubs start conversations with players"
-- adds a real current Player check for the recipient.
DROP POLICY "Clubs start conversations with players" ON public.conversations;

CREATE POLICY "Clubs start conversations with players"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = club_id
    AND EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type = 'club'::account_type
    )
    AND EXISTS (
      SELECT 1
      FROM players pl
      WHERE pl.id = conversations.player_id
    )
    AND private.profile_is_type(player_id, 'player'::account_type)
    AND NOT messaging_blocked(club_id, player_id)
  );
