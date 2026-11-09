-- Add usable cosmetic state without replacing any existing profile data.
ALTER TABLE player_profiles ADD COLUMN equipped_skin TEXT;
