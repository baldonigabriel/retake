CREATE FUNCTION prevent_last_login_account()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Serialise removals per user so two tabs cannot delete the two remaining
  -- providers at the same time and both observe the other row.
  PERFORM pg_advisory_xact_lock(hashtextextended(OLD.user_id, 0));

  IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id)
     AND NOT EXISTS (SELECT 1 FROM accounts WHERE user_id = OLD.user_id) THEN
    RAISE EXCEPTION 'A user must keep at least one login account'
      USING ERRCODE = '23514', CONSTRAINT = 'accounts_require_login';
  END IF;

  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER accounts_require_login
AFTER DELETE ON accounts
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION prevent_last_login_account();
