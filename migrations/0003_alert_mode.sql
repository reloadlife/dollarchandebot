-- once = fire once then delete; repeat = re-arm when condition clears
ALTER TABLE alerts ADD COLUMN mode TEXT NOT NULL DEFAULT 'once';
-- 1 = ready to fire; 0 = waiting for condition to clear (repeat only)
ALTER TABLE alerts ADD COLUMN armed INTEGER NOT NULL DEFAULT 1;
