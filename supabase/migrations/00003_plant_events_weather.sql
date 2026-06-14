-- N1.5: weather context logged on every plant_event.
-- NULL on existing rows distinguishes "not yet captured" from a future
-- "captured but no data available" (which would be {} or partial JSON).

alter table plant_events add column weather jsonb;
