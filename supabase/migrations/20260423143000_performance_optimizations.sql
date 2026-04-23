-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_competition_invites_invited_by ON competition_invites(invited_by);
CREATE INDEX IF NOT EXISTS idx_competition_participants_user_id ON competition_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_competition_scores_score_id ON competition_scores(score_id);
CREATE INDEX IF NOT EXISTS idx_competition_scores_user_id ON competition_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_competitions_created_by ON competitions(created_by);
CREATE INDEX IF NOT EXISTS idx_pub_place_details_updated_by ON pub_place_details(updated_by);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_friends_friend_user_id ON user_friends(friend_user_id);

-- Optimize RLS policies to prevent auth_rls_initplan performance issue by using subqueries

-- competitions
DROP POLICY IF EXISTS competitions_insert_own ON competitions;
CREATE POLICY competitions_insert_own ON competitions FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS competitions_update_own ON competitions;
CREATE POLICY competitions_update_own ON competitions FOR UPDATE TO authenticated USING ((select auth.uid()) = created_by) WITH CHECK ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS competitions_delete_own ON competitions;
CREATE POLICY competitions_delete_own ON competitions FOR DELETE TO authenticated USING ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS competitions_select_visible ON competitions;
CREATE POLICY competitions_select_visible ON competitions FOR SELECT TO public USING (
  ((visibility = 'public'::text) OR (((select auth.uid()) IS NOT NULL) AND (created_by = (select auth.uid()))) OR (((select auth.uid()) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM competition_participants p
  WHERE ((p.competition_id = competitions.id) AND (p.user_id = (select auth.uid())))))) OR (((select auth.uid()) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM competition_invites i
  WHERE ((i.competition_id = competitions.id) AND (lower(TRIM(BOTH FROM (i.invited_email)::text)) = lower(TRIM(BOTH FROM COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text)))))))) OR (((select auth.uid()) IS NOT NULL) AND (visibility = 'private'::text) AND (EXISTS ( SELECT 1
   FROM user_friends f
  WHERE (((f.user_id = (select auth.uid())) AND (f.friend_user_id = competitions.created_by)) OR ((f.friend_user_id = (select auth.uid())) AND (f.user_id = competitions.created_by)))))))
);

-- competition_scores
DROP POLICY IF EXISTS competition_scores_insert_auth ON competition_scores;
CREATE POLICY competition_scores_insert_auth ON competition_scores FOR INSERT TO authenticated WITH CHECK (((user_id IS NULL) OR ((select auth.uid()) = user_id)));

DROP POLICY IF EXISTS competition_scores_read ON competition_scores;
CREATE POLICY competition_scores_read ON competition_scores FOR SELECT TO public USING (
  (EXISTS ( SELECT 1
   FROM competitions c
  WHERE ((c.id = competition_scores.competition_id) AND ((c.visibility = 'public'::text) OR (((select auth.uid()) IS NOT NULL) AND (c.created_by = (select auth.uid()))) OR (((select auth.uid()) IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM competition_participants p
          WHERE ((p.competition_id = c.id) AND (p.user_id = (select auth.uid())))))) OR (((select auth.uid()) IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM competition_invites i
          WHERE ((i.competition_id = c.id) AND (lower(TRIM(BOTH FROM (i.invited_email)::text)) = lower(TRIM(BOTH FROM COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text)))))))) OR (((select auth.uid()) IS NOT NULL) AND (c.visibility = 'private'::text) AND (EXISTS ( SELECT 1
           FROM user_friends f
          WHERE (((f.user_id = (select auth.uid())) AND (f.friend_user_id = c.created_by)) OR ((f.friend_user_id = (select auth.uid())) AND (f.user_id = c.created_by))))))))))
);

-- user_favorite_bars
DROP POLICY IF EXISTS user_favorite_bars_select_own ON user_favorite_bars;
CREATE POLICY user_favorite_bars_select_own ON user_favorite_bars FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS user_favorite_bars_insert_own ON user_favorite_bars;
CREATE POLICY user_favorite_bars_insert_own ON user_favorite_bars FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS user_favorite_bars_delete_own ON user_favorite_bars;
CREATE POLICY user_favorite_bars_delete_own ON user_favorite_bars FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));

-- competition_participants
DROP POLICY IF EXISTS competition_participants_delete_self ON competition_participants;
CREATE POLICY competition_participants_delete_self ON competition_participants FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS competition_participants_insert ON competition_participants;
CREATE POLICY competition_participants_insert ON competition_participants FOR INSERT TO authenticated WITH CHECK (
  (((user_id = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM competitions c
  WHERE ((c.id = competition_participants.competition_id) AND (c.visibility = 'public'::text)))) OR (EXISTS ( SELECT 1
   FROM competition_invites i
  WHERE ((i.competition_id = competition_participants.competition_id) AND (lower(TRIM(BOTH FROM (i.invited_email)::text)) = lower(TRIM(BOTH FROM COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text))))))) OR (EXISTS ( SELECT 1
   FROM competitions c
  WHERE ((c.id = competition_participants.competition_id) AND (c.visibility = 'private'::text) AND (EXISTS ( SELECT 1
           FROM user_friends f
          WHERE (((f.user_id = (select auth.uid())) AND (f.friend_user_id = c.created_by)) OR ((f.friend_user_id = (select auth.uid())) AND (f.user_id = c.created_by)))))))))) OR ((EXISTS ( SELECT 1
   FROM competitions c
  WHERE ((c.id = competition_participants.competition_id) AND (c.created_by = (select auth.uid()))))) AND (EXISTS ( SELECT 1
   FROM user_friends f
  WHERE (((f.user_id = (select auth.uid())) AND (f.friend_user_id = competition_participants.user_id)) OR ((f.friend_user_id = (select auth.uid())) AND (f.user_id = competition_participants.user_id)))))))
);

-- public_profiles
DROP POLICY IF EXISTS public_profiles_insert_own ON public_profiles;
CREATE POLICY public_profiles_insert_own ON public_profiles FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS public_profiles_update_own ON public_profiles;
CREATE POLICY public_profiles_update_own ON public_profiles FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));

-- friend_requests
DROP POLICY IF EXISTS friend_requests_select ON friend_requests;
CREATE POLICY friend_requests_select ON friend_requests FOR SELECT TO authenticated USING (((from_user_id = (select auth.uid())) OR (lower(TRIM(BOTH FROM (to_email)::text)) = lower(TRIM(BOTH FROM COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text))))));

DROP POLICY IF EXISTS friend_requests_insert ON friend_requests;
CREATE POLICY friend_requests_insert ON friend_requests FOR INSERT TO authenticated WITH CHECK ((from_user_id = (select auth.uid())));

DROP POLICY IF EXISTS friend_requests_update ON friend_requests;
CREATE POLICY friend_requests_update ON friend_requests FOR UPDATE TO authenticated USING (((from_user_id = (select auth.uid())) OR (lower(TRIM(BOTH FROM (to_email)::text)) = lower(TRIM(BOTH FROM COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text))))));

-- user_friends
DROP POLICY IF EXISTS user_friends_select ON user_friends;
CREATE POLICY user_friends_select ON user_friends FOR SELECT TO authenticated USING (((user_id = (select auth.uid())) OR (friend_user_id = (select auth.uid()))));

DROP POLICY IF EXISTS user_friends_delete ON user_friends;
CREATE POLICY user_friends_delete ON user_friends FOR DELETE TO authenticated USING (((user_id = (select auth.uid())) OR (friend_user_id = (select auth.uid()))));

DROP POLICY IF EXISTS user_friends_insert ON user_friends;
CREATE POLICY user_friends_insert ON user_friends FOR INSERT TO authenticated WITH CHECK (
  ((user_id = (select auth.uid())) OR ((friend_user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM friend_requests fr
  WHERE ((fr.from_user_id = user_friends.user_id) AND (lower(TRIM(BOTH FROM (fr.to_email)::text)) = lower(TRIM(BOTH FROM COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text)))) AND (fr.status = 'accepted'::text))))))
);

-- competition_invites
DROP POLICY IF EXISTS competition_invites_insert ON competition_invites;
CREATE POLICY competition_invites_insert ON competition_invites FOR INSERT TO authenticated WITH CHECK (
  ((invited_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM competitions c
  WHERE ((c.id = competition_invites.competition_id) AND (c.created_by = (select auth.uid()))))))
);

DROP POLICY IF EXISTS competition_invites_delete ON competition_invites;
CREATE POLICY competition_invites_delete ON competition_invites FOR DELETE TO authenticated USING (
  (EXISTS ( SELECT 1
   FROM competitions c
  WHERE ((c.id = competition_invites.competition_id) AND (c.created_by = (select auth.uid())))))
);

DROP POLICY IF EXISTS competition_invites_select ON competition_invites;
CREATE POLICY competition_invites_select ON competition_invites FOR SELECT TO authenticated USING (
  ((invited_by = (select auth.uid())) OR (lower(TRIM(BOTH FROM (invited_email)::text)) = lower(TRIM(BOTH FROM COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text)))))
);

-- pub_place_details
DROP POLICY IF EXISTS pub_place_details_insert_admin ON pub_place_details;
CREATE POLICY pub_place_details_insert_admin ON pub_place_details FOR INSERT TO authenticated WITH CHECK ((lower(TRIM(BOTH FROM COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text))) = lower(TRIM(BOTH FROM 'admin.rixou@gmail.com'::text))));

DROP POLICY IF EXISTS pub_place_details_update_admin ON pub_place_details;
CREATE POLICY pub_place_details_update_admin ON pub_place_details FOR UPDATE TO authenticated USING ((lower(TRIM(BOTH FROM COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text))) = lower(TRIM(BOTH FROM 'admin.rixou@gmail.com'::text)))) WITH CHECK ((lower(TRIM(BOTH FROM COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text))) = lower(TRIM(BOTH FROM 'admin.rixou@gmail.com'::text))));

-- push_subscriptions
DROP POLICY IF EXISTS push_subscriptions_select_own ON push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON push_subscriptions FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS push_subscriptions_insert_own ON push_subscriptions;
CREATE POLICY push_subscriptions_insert_own ON push_subscriptions FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS push_subscriptions_update_own ON push_subscriptions;
CREATE POLICY push_subscriptions_update_own ON push_subscriptions FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));

-- user_achievements
DROP POLICY IF EXISTS user_achievements_select_own ON user_achievements;
CREATE POLICY user_achievements_select_own ON user_achievements FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS user_achievements_insert_own ON user_achievements;
CREATE POLICY user_achievements_insert_own ON user_achievements FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- user_streak_snapshots
DROP POLICY IF EXISTS user_streak_snapshots_select_own ON user_streak_snapshots;
CREATE POLICY user_streak_snapshots_select_own ON user_streak_snapshots FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS user_streak_snapshots_upsert_own ON user_streak_snapshots;
CREATE POLICY user_streak_snapshots_upsert_own ON user_streak_snapshots FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));
