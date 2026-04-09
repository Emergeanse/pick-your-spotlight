
-- ============================================================
-- TABLE 1: catalog_item_relations (film <-> person)
-- ============================================================
CREATE TABLE public.catalog_item_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  person_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('actor','director','writer')),
  character_name text,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, person_item_id, relation_type)
);

ALTER TABLE public.catalog_item_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read relations"
  ON public.catalog_item_relations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage relations"
  ON public.catalog_item_relations FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_relations_item ON public.catalog_item_relations(item_id);
CREATE INDEX idx_relations_person ON public.catalog_item_relations(person_item_id);
CREATE INDEX idx_relations_type ON public.catalog_item_relations(relation_type);

-- ============================================================
-- TABLE 2: user_wishlist (auto-populated on like/love)
-- ============================================================
CREATE TABLE public.user_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

ALTER TABLE public.user_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wishlist"
  ON public.user_wishlist FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wishlist"
  ON public.user_wishlist FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wishlist"
  ON public.user_wishlist FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wishlist"
  ON public.user_wishlist FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_wishlist_user ON public.user_wishlist(user_id);
CREATE INDEX idx_wishlist_status ON public.user_wishlist(user_id, status);
