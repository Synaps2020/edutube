-- Recherche plein texte (titre, description, mots-clés, transcription) — dictionnaire français,
-- insensible aux accents (unaccent). L'index n'est pas exprimable en Prisma : SQL brut.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() est STABLE ; un index d'expression exige une fonction IMMUTABLE : enveloppe usuelle.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;

CREATE OR REPLACE FUNCTION media_search_vector(title text, description text, keywords text[], transcript text, chapter text)
RETURNS tsvector LANGUAGE sql IMMUTABLE AS $$
  SELECT setweight(to_tsvector('french', f_unaccent(coalesce(title, ''))), 'A')
      || setweight(to_tsvector('french', f_unaccent(coalesce(array_to_string(keywords, ' '), ''))), 'A')
      || setweight(to_tsvector('french', f_unaccent(coalesce(chapter, ''))), 'B')
      || setweight(to_tsvector('french', f_unaccent(coalesce(description, ''))), 'B')
      || setweight(to_tsvector('french', f_unaccent(coalesce(transcript, ''))), 'C');
$$;

CREATE INDEX IF NOT EXISTS "Media_search_idx"
  ON "Media" USING GIN (media_search_vector(title, description, keywords, transcript, chapter));

-- Suggestions (autocomplétion) et recherche tolérante aux fautes : trigrammes sur le titre
CREATE INDEX IF NOT EXISTS "Media_title_trgm_idx" ON "Media" USING GIN (title gin_trgm_ops);
