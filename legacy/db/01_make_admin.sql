-- ==============================================================================
-- SCRIPT: HACER A UN USUARIO ADMINISTRADOR
-- ==============================================================================
-- Instrucciones:
-- 1. Cambia 'tu_email@ejemplo.com' por el correo del usuario que quieres hacer admin.
-- 2. Ejecuta este script en el SQL Editor de Supabase.
-- ==============================================================================

UPDATE public.profiles
SET
    is_admin = true
WHERE
    email = 'tu_email@ejemplo.com';

-- Para verificar que se ha aplicado correctamente, puedes ejecutar:
-- SELECT email, display_name, is_admin FROM public.profiles WHERE is_admin = true;