-- Les limites annoncées par les buckets doivent correspondre à ce que l'API
-- peut réellement accepter : le corps d'une fonction serverless Vercel est
-- plafonné à ~4,5 Mo. Annoncer 50 Mo conduirait à un échec au dépôt plutôt
-- qu'à un refus clair et immédiat.
--
-- Pour relever cette limite, brancher un stockage d'objets externe et
-- remplacer `storage.objects.data` par une clé d'objet.

update storage.buckets set file_size_limit = 4194304 where file_size_limit > 4194304;

comment on column storage.objects.data is
  'Contenu du fichier. Limité à 4 Mo par la taille maximale du corps des fonctions serverless ; remplacer par une clé d''objet externe pour lever cette limite.';
