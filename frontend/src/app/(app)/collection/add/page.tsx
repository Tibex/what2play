'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import GameCard from '@/components/GameCard';
import type { Game, GameOwnership, BggSearchResult } from '@/lib/types';

export default function CollectionAddPage() {
  const [collection, setCollection] = useState<GameOwnership[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [localResults, setLocalResults] = useState<Game[]>([]);
  const [bggResults, setBggResults] = useState<BggSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchingBgg, setSearchingBgg] = useState(false);
  const [importingBggId, setImportingBggId] = useState<number | null>(null);
  const [xmlContent, setXmlContent] = useState('');
  const [xmlImporting, setXmlImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadCollection();
  }, []);

  const loadCollection = async () => {
    const data = await api.get<GameOwnership[]>('/games/collection');
    setCollection(data);
    setLoading(false);
  };

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchingBgg(true);
    setLocalResults([]);
    setBggResults([]);

    const localPromise = api
      .get<Game[]>(`/games/search?q=${encodeURIComponent(q)}`)
      .then(setLocalResults)
      .catch(() => {})
      .finally(() => setSearching(false));

    const bggPromise = api
      .get<BggSearchResult[]>(`/bgg/search?q=${encodeURIComponent(q)}`)
      .then(setBggResults)
      .catch(() => {})
      .finally(() => setSearchingBgg(false));

    await Promise.all([localPromise, bggPromise]);
  }, [searchQuery]);

  const addToCollection = async (gameId: string) => {
    try {
      await api.post(`/games/collection/${gameId}`);
      toast.success('Added to collection');
      loadCollection();
      setLocalResults((prev) => prev.filter((g) => g.id !== gameId));
    } catch {
      /* toast auto-shown by api.ts */
    }
  };

  const importAndAdd = async (bggId: number) => {
    setImportingBggId(bggId);
    try {
      await api.post<{ game: Game }>('/bgg/import-one', { bggId });
      toast.success('Imported and added to collection');
      setBggResults((prev) => prev.filter((r) => r.bggId !== bggId));
      await loadCollection();
    } catch {
      /* toast auto-shown by api.ts */
    } finally {
      setImportingBggId(null);
    }
  };

  const [bggUsername, setBggUsername] = useState('');

  const handleBggLink = async () => {
    if (!bggUsername.trim()) return;
    try {
      await api.post('/bgg/link', { bggUsername });
      toast.success('BGG account linked!');
    } catch {
      /* toast auto-shown by api.ts */
    }
  };

  const handleBggSync = async () => {
    setSyncing(true);
    try {
      const result = await api.post<{ imported: number }>('/bgg/sync');
      toast.success(`Imported ${result.imported} games from BGG`);
      loadCollection();
    } catch {
      /* toast auto-shown by api.ts */
    } finally {
      setSyncing(false);
    }
  };

  const handleXmlImport = async () => {
    if (!xmlContent.trim()) return;
    setXmlImporting(true);
    try {
      const result = await api.post<{ imported: number; fetched: number }>(
        '/bgg/import-xml',
        { xml: xmlContent },
      );
      toast.success(`Imported ${result.imported} games from XML`);
      setXmlContent('');
      loadCollection();
    } catch {
      /* toast auto-shown by api.ts */
    } finally {
      setXmlImporting(false);
    }
  };

  const collectionBggIds = new Set(collection.map((o) => o.game.bggId).filter(Boolean));
  const localBggIds = new Set(localResults.map((g) => g.bggId).filter(Boolean));
  const filteredBggResults = bggResults.filter(
    (r) => !collectionBggIds.has(r.bggId) && !localBggIds.has(r.bggId),
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add Games</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold mb-3">Search & Add</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
            placeholder="Search by title (local + BoardGameGeek)..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
          <button
            onClick={() => void handleSearch()}
            disabled={searching && searchingBgg}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {searching || searchingBgg ? 'Searching...' : 'Search'}
          </button>
        </div>

        {localResults.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Already in database
            </h3>
            <div className="space-y-2">
              {localResults.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  actions={
                    <button
                      onClick={() => void addToCollection(game.id)}
                      className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 transition"
                    >
                      + Add
                    </button>
                  }
                />
              ))}
            </div>
          </div>
        )}

        {searchingBgg && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
            Searching BoardGameGeek...
          </div>
        )}

        {!searchingBgg && filteredBggResults.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              From BoardGameGeek
            </h3>
            <div className="space-y-2">
              {filteredBggResults.map((result) => (
                <BggResultCard
                  key={result.bggId}
                  result={result}
                  importing={importingBggId === result.bggId}
                  onImport={() => void importAndAdd(result.bggId)}
                />
              ))}
            </div>
          </div>
        )}

        {!searching && !searchingBgg && searchQuery && localResults.length === 0 && filteredBggResults.length === 0 && (
          <p className="text-sm text-gray-500">
            No results found for &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold mb-3">Import from BoardGameGeek</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={bggUsername}
            onChange={(e) => setBggUsername(e.target.value)}
            placeholder="BGG username"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            onClick={() => void handleBggLink()}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition"
          >
            Link
          </button>
          <button
            onClick={() => void handleBggSync()}
            disabled={syncing}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition"
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold mb-2">Manual XML Import (no BGG token needed)</h2>
        <p className="text-sm text-gray-500 mb-3">
          While logged into BGG in your browser, open your collection XML page and paste the
          response body here.
        </p>
        <textarea
          value={xmlContent}
          onChange={(e) => setXmlContent(e.target.value)}
          rows={8}
          placeholder="Paste XML from https://boardgamegeek.com/xmlapi2/collection?username=YOUR_NAME&own=1&stats=1"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void handleXmlImport()}
            disabled={xmlImporting || !xmlContent.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {xmlImporting ? 'Importing...' : 'Import XML'}
          </button>
          <button
            onClick={() => setXmlContent('')}
            disabled={xmlImporting || !xmlContent.trim()}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function BggResultCard({
  result,
  importing,
  onImport,
}: {
  result: BggSearchResult;
  importing: boolean;
  onImport: () => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex">
        {result.thumbnailUrl && (
          <img
            src={result.thumbnailUrl}
            alt={result.title}
            className="w-24 h-24 object-cover flex-shrink-0"
          />
        )}
        <div className="p-4 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{result.title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {result.minPlayers && result.maxPlayers
                  ? `${result.minPlayers}-${result.maxPlayers} players`
                  : ''}
                {result.playingTime ? ` · ${result.playingTime} min` : ''}
                {result.yearPublished ? ` · ${result.yearPublished}` : ''}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={onImport}
              disabled={importing}
              className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full hover:bg-indigo-200 disabled:opacity-50 transition inline-flex items-center gap-1"
            >
              {importing && (
                <span className="animate-spin inline-block h-3 w-3 border-b-2 border-indigo-600 rounded-full" />
              )}
              {importing ? 'Importing...' : '+ Import & Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

