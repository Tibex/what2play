'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import GameCard from '@/components/GameCard';
import type { Game, GameOwnership } from '@/lib/types';

export default function CollectionPage() {
  const [collection, setCollection] = useState<GameOwnership[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bggUsername, setBggUsername] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState('');
  const [xmlContent, setXmlContent] = useState('');
  const [xmlImporting, setXmlImporting] = useState(false);

  useEffect(() => {
    loadCollection();
  }, []);

  const loadCollection = async () => {
    const data = await api.get<GameOwnership[]>('/games/collection');
    setCollection(data);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await api.get<Game[]>(`/games/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const addToCollection = async (gameId: string) => {
    await api.post(`/games/collection/${gameId}`);
    loadCollection();
    setSearchResults((prev) => prev.filter((g) => g.id !== gameId));
  };

  const removeFromCollection = async (gameId: string) => {
    await api.delete(`/games/collection/${gameId}`);
    loadCollection();
  };

  const handleBggLink = async () => {
    if (!bggUsername.trim()) return;
    await api.post('/bgg/link', { bggUsername });
    setSyncResult('Account linked!');
  };

  const handleBggSync = async () => {
    setSyncing(true);
    setSyncResult('');
    try {
      const result = await api.post<{ imported: number }>('/bgg/sync');
      setSyncResult(`Imported ${result.imported} games from BGG`);
      loadCollection();
    } catch (err: unknown) {
      setSyncResult(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleXmlImport = async () => {
    if (!xmlContent.trim()) return;
    setXmlImporting(true);
    setSyncResult('');
    try {
      const result = await api.post<{ imported: number; fetched: number }>('/bgg/import-xml', {
        xml: xmlContent,
      });
      setSyncResult(`Imported ${result.imported} games from pasted XML (parsed ${result.fetched})`);
      setXmlContent('');
      loadCollection();
    } catch (err: unknown) {
      setSyncResult(err instanceof Error ? err.message : 'XML import failed');
    } finally {
      setXmlImporting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Collection</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold mb-3">Add Games</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search games by title..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
          <button onClick={handleSearch} disabled={searching} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2 mb-4">
            {searchResults.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                actions={
                  <button onClick={() => addToCollection(game.id)} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 transition">
                    + Add
                  </button>
                }
              />
            ))}
          </div>
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
          <button onClick={handleBggLink} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition">
            Link
          </button>
          <button onClick={handleBggSync} disabled={syncing} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition">
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
        {syncResult && <p className="text-sm text-green-600">{syncResult}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold mb-2">Manual XML Import (no BGG token needed)</h2>
        <p className="text-sm text-gray-500 mb-3">
          While logged into BGG in your browser, open your collection XML page and paste the response body here.
        </p>
        <textarea
          value={xmlContent}
          onChange={(e) => setXmlContent(e.target.value)}
          rows={8}
          placeholder='Paste XML from https://boardgamegeek.com/xmlapi2/collection?username=YOUR_NAME&own=1&stats=1'
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleXmlImport}
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

      {collection.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No games in your collection yet. Search above or sync from BGG.</p>
      ) : (
        <div>
          <h2 className="font-semibold text-gray-700 mb-4">Your Games ({collection.length})</h2>
          <div className="space-y-3">
            {collection.map((ownership) => (
              <GameCard
                key={ownership.id}
                game={ownership.game}
                actions={
                  <button onClick={() => removeFromCollection(ownership.gameId)} className="text-xs text-red-500 hover:text-red-700 transition">
                    Remove
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
