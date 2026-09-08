import { createClient } from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"https://lclvshhdmxdiddwnwlhz.supabase.co";
const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbHZzaGhkbXhkaWRkd253bGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTY1NzIsImV4cCI6MjEwNDAzMjU3Mn0.UM0w0-uTXjrzG5Aw-t12Djp4IlpCMDuQQGSlwLvIqgs";
export const supabase=createClient(url,publishableKey);
