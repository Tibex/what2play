import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BggService } from './bgg.service';
import { SyncAccount } from '../entities/sync-account.entity';
import { BggVerificationChallenge } from '../entities/bgg-verification-challenge.entity';
import { BggCatalogSync } from '../entities/bgg-catalog-sync.entity';
import { GamesService } from '../games/games.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

describe('BggService', () => {
  let service: BggService;
  const originalFetch = global.fetch;
  const toUrl = (input: RequestInfo | URL) => {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
  };

  const mockSyncRepo = {
    findOne: jest.fn(),
    save: jest.fn((data) => data),
    create: jest.fn((data) => data),
    delete: jest.fn(),
  };

  const mockVerifyRepo = {
    save: jest.fn((data) => data),
    create: jest.fn((data) => data),
  };
  const mockCatalogSyncRepo = {
    findOne: jest.fn(),
    save: jest.fn((data) => data),
    create: jest.fn((data) => data),
  };

  const mockGamesService = {
    findOrCreateByBggId: jest.fn(),
    addToCollection: jest.fn(),
    rateGame: jest.fn(),
    getUserOwnedGamesByIds: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };
  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BggService,
        { provide: getRepositoryToken(SyncAccount), useValue: mockSyncRepo },
        {
          provide: getRepositoryToken(BggVerificationChallenge),
          useValue: mockVerifyRepo,
        },
        {
          provide: getRepositoryToken(BggCatalogSync),
          useValue: mockCatalogSyncRepo,
        },
        { provide: GamesService, useValue: mockGamesService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<BggService>(BggService);
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('token');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses min/max players from <stats ...> attributes in XML import', async () => {
    mockGamesService.findOrCreateByBggId.mockImplementation(
      async (bggId: number, data: Record<string, unknown>) => ({
        id: `g-${bggId}`,
        bggId,
        ...data,
      }),
    );
    mockGamesService.addToCollection.mockResolvedValue(undefined);

    const xml = `
      <items totalitems="2">
        <item objectid="37111">
          <name>Battlestar Galactica: The Board Game</name>
          <stats minplayers="3" maxplayers="6" playingtime="180"></stats>
        </item>
        <item objectid="36932">
          <name>Claustrophobia</name>
          <stats minplayers="2" maxplayers="2" playingtime="45"></stats>
        </item>
      </items>
    `;

    await service.importCollectionFromXml('u1', xml);

    expect(mockGamesService.findOrCreateByBggId).toHaveBeenNthCalledWith(
      1,
      37111,
      expect.objectContaining({
        title: 'Battlestar Galactica: The Board Game',
        minPlayers: 3,
        maxPlayers: 6,
        playingTime: 180,
      }),
    );
    expect(mockGamesService.findOrCreateByBggId).toHaveBeenNthCalledWith(
      2,
      36932,
      expect.objectContaining({
        title: 'Claustrophobia',
        minPlayers: 2,
        maxPlayers: 2,
        playingTime: 45,
      }),
    );
  });

  it('prioritizes exact title matches in BGG search results', async () => {
    const exactXml = `
      <items total="1">
        <item type="boardgame" id="13">
          <name type="primary" value="Catan" />
          <yearpublished value="1995" />
        </item>
      </items>
    `;
    const broadXml = `
      <items total="3">
        <item type="boardgame" id="13">
          <name type="primary" value="Catan" />
          <yearpublished value="1995" />
        </item>
        <item type="boardgame" id="14">
          <name type="primary" value="The Settlers of Catan" />
          <yearpublished value="1995" />
        </item>
        <item type="boardgame" id="15">
          <name type="primary" value="Catan Dice Game" />
          <yearpublished value="2011" />
        </item>
      </items>
    `;
    const thingXml = `
      <items>
        <item type="boardgame" id="13">
          <name type="primary" value="Catan" />
          <thumbnail>https://img/13.jpg</thumbnail>
          <stats minplayers="3" maxplayers="4" playingtime="90" />
          <yearpublished value="1995" />
          <statistics><ratings><average value="7.1" /></ratings></statistics>
        </item>
        <item type="boardgame" id="14">
          <name type="primary" value="The Settlers of Catan" />
          <stats minplayers="3" maxplayers="4" playingtime="90" />
          <yearpublished value="1995" />
          <statistics><ratings><average value="7.2" /></ratings></statistics>
        </item>
        <item type="boardgame" id="15">
          <name type="primary" value="Catan Dice Game" />
          <stats minplayers="1" maxplayers="4" playingtime="30" />
          <yearpublished value="2011" />
          <statistics><ratings><average value="6.4" /></ratings></statistics>
        </item>
      </items>
    `;

    global.fetch = jest.fn((input: URL | RequestInfo) => {
      const url = toUrl(input);
      if (url.includes('/search?') && url.includes('exact=1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(exactXml),
        } as Response);
      }
      if (url.includes('/search?')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(broadXml),
        } as Response);
      }
      if (url.includes('/thing?id=')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(thingXml),
        } as Response);
      }
      throw new Error(`Unexpected URL ${url}`);
    }) as typeof fetch;

    const results = await service.searchBgg('catan');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].bggId).toBe(13);
    expect(results[0].title).toBe('Catan');
    expect(results[0].bggRating).toBe(7.1);
  });

  it('still returns results when exact search request fails', async () => {
    const broadXml = `
      <items total="1">
        <item type="boardgame" id="92">
          <name type="primary" value="Ticket to Ride" />
          <yearpublished value="2004" />
        </item>
      </items>
    `;
    const thingXml = `
      <items>
        <item type="boardgame" id="92">
          <name type="primary" value="Ticket to Ride" />
          <stats minplayers="2" maxplayers="5" playingtime="60" />
          <yearpublished value="2004" />
          <statistics><ratings><average value="7.4" /></ratings></statistics>
        </item>
      </items>
    `;

    global.fetch = jest.fn((input: URL | RequestInfo) => {
      const url = toUrl(input);
      if (url.includes('/search?') && url.includes('exact=1')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('error'),
        } as Response);
      }
      if (url.includes('/search?')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(broadXml),
        } as Response);
      }
      if (url.includes('/thing?id=')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(thingXml),
        } as Response);
      }
      throw new Error(`Unexpected URL ${url}`);
    }) as typeof fetch;

    const results = await service.searchBgg('ticket to ride');

    expect(results).toHaveLength(1);
    expect(results[0].bggId).toBe(92);
    expect(results[0].title).toBe('Ticket to Ride');
  });

  it('exports selected games as CSV and XML', async () => {
    mockGamesService.getUserOwnedGamesByIds.mockResolvedValue([
      { id: 'g1', bggId: 13, title: 'Catan' },
      { id: 'g2', bggId: 822, title: 'Carcassonne' },
    ]);

    const csv = await service.exportSelectionAsCsv('u1', ['g1', 'g2']);
    const xml = await service.exportSelectionAsXml('u1', ['g1', 'g2']);

    expect(csv).toContain('gameId,bggId,title');
    expect(csv).toContain('g1,13,"Catan"');
    expect(xml).toContain('<item objecttype="thing" objectid="13"');
    expect(xml).toContain('<name>Carcassonne</name>');
  });
});
