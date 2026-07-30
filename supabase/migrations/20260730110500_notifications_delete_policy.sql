-- Create policy to allow recipients to delete their own notifications
CREATE POLICY "Recipient deletes own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (recipient_user_id = auth.uid());
