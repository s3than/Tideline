import type { APIRoute } from 'astro';
import {
  getMediaById,
  getSeasonIdsBySeriesId,
  deleteMediaByIds,
  removeLeavingSoon,
  clearKeepRequests,
  clearNominations,
} from '../../../../../lib/db';
import { refreshJellyfinLibrary } from '../../../../../lib/jellyfin';
import {
  findRadarrMovieByTmdbId,
  deleteRadarrMovie,
  isRadarrConfigured,
} from '../../../../../lib/arr/radarr';
import {
  findSonarrSeriesByTvdbId,
  deleteSonarrSeries,
  getSeasonEpisodeFiles,
  deleteEpisodeFilesBulk,
  unmonitorSeason,
  isSonarrConfigured,
} from '../../../../../lib/arr/sonarr';
import { json, requireAdmin, ITEM_ID_RE, toErrorMessage } from '../../../../../lib/response';

export const POST: APIRoute = async ({ params, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const { id } = params;
  if (!id || !ITEM_ID_RE.test(id)) return json({ error: 'Bad request' }, 400);

  const item = getMediaById(id);
  if (!item) return json({ error: 'Item not found' }, 404);

  try {
    if (item.itemType === 'Movie') {
      if (!isRadarrConfigured()) return json({ error: 'Radarr is not configured' }, 422);

      const tmdbId = item.providerIds?.Tmdb;
      if (!tmdbId) return json({ error: 'Item has no TMDb ID — cannot locate in Radarr' }, 422);

      const radarrMovie = await findRadarrMovieByTmdbId(tmdbId);
      if (radarrMovie) {
        await deleteRadarrMovie(radarrMovie.id);
      }

      deleteMediaByIds([id]);
      removeLeavingSoon(id);
      clearKeepRequests(id);
      clearNominations(id);
      void refreshJellyfinLibrary().catch(() => {});

      return json({ ok: true, deletedFrom: radarrMovie ? 'radarr+jellyfin' : 'jellyfin' });
    }

    if (item.itemType === 'Series') {
      if (!isSonarrConfigured()) return json({ error: 'Sonarr is not configured' }, 422);

      const tvdbId = item.providerIds?.Tvdb;
      if (!tvdbId) return json({ error: 'Series has no TVDb ID — cannot locate in Sonarr' }, 422);

      const sonarrSeries = await findSonarrSeriesByTvdbId(tvdbId);
      if (sonarrSeries) {
        await deleteSonarrSeries(sonarrSeries.id);
      }

      const seasonIds = getSeasonIdsBySeriesId(id);
      const allIds = [id, ...seasonIds];
      deleteMediaByIds(allIds);
      for (const sid of allIds) {
        removeLeavingSoon(sid);
        clearKeepRequests(sid);
        clearNominations(sid);
      }
      void refreshJellyfinLibrary().catch(() => {});

      return json({ ok: true, deletedFrom: sonarrSeries ? 'sonarr+jellyfin' : 'jellyfin' });
    }

    if (item.itemType === 'Season') {
      if (!isSonarrConfigured()) return json({ error: 'Sonarr is not configured' }, 422);

      // Find the parent series to get its TVDB ID
      const seriesId = item.seriesId;
      const seriesItem = seriesId ? getMediaById(seriesId) : null;
      const tvdbId = seriesItem?.providerIds?.Tvdb;

      if (!tvdbId) {
        return json({ error: 'Parent series has no TVDb ID — cannot locate in Sonarr' }, 422);
      }

      const sonarrSeries = await findSonarrSeriesByTvdbId(tvdbId);
      if (sonarrSeries && item.indexNumber != null) {
        const files = await getSeasonEpisodeFiles(sonarrSeries.id, item.indexNumber);
        await deleteEpisodeFilesBulk(files.map((f) => f.id));
        await unmonitorSeason(sonarrSeries.id, item.indexNumber);
      }

      deleteMediaByIds([id]);
      removeLeavingSoon(id);
      clearKeepRequests(id);
      clearNominations(id);
      void refreshJellyfinLibrary().catch(() => {});

      return json({ ok: true, deletedFrom: sonarrSeries ? 'sonarr+jellyfin' : 'jellyfin' });
    }

    return json({ error: `Unsupported item type: ${item.itemType}` }, 422);
  } catch (e: unknown) {
    return json({ error: toErrorMessage(e) }, 502);
  }
};
