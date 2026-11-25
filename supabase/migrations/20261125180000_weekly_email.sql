-- Weekly email is opt-in (sent on the Saturday run by backend/app/services/email_service.py).
alter table public.user_profiles add column if not exists weekly_email boolean not null default false;
