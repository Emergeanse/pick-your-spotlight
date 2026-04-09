
-- Fix catalog_items: restrict write to admins
DROP POLICY "Authenticated can insert catalog items" ON public.catalog_items;
DROP POLICY "Authenticated can update catalog items" ON public.catalog_items;

CREATE POLICY "Service can insert catalog items"
  ON public.catalog_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can update catalog items"
  ON public.catalog_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix catalog_item_tags: restrict write to admins
DROP POLICY "Authenticated can insert catalog item tags" ON public.catalog_item_tags;

CREATE POLICY "Service can insert catalog item tags"
  ON public.catalog_item_tags FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
