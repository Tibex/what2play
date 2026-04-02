import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationDelivery } from '../entities/notification-delivery.entity';
import { NotificationRecipientDelivery } from '../entities/notification-recipient-delivery.entity';

describe('NotificationDeliveryService', () => {
  let service: NotificationDeliveryService;

  let mockConfigService: { get: jest.Mock };
  let mockDataSource: { createQueryRunner: jest.Mock };
  let mockQueryRunner: {
    connect: jest.Mock;
    query: jest.Mock;
    release: jest.Mock;
  };
  let mockRepo: {
    findOne: jest.Mock;
    findOneByOrFail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let mockRecipientInsertBuilder: {
    insert: jest.Mock;
    values: jest.Mock;
    orIgnore: jest.Mock;
    execute: jest.Mock;
  };
  let mockRecipientRepo: {
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const payload = {
    eventId: 'event-1',
    type: 'feedback_prompt' as const,
    idempotencyKey: 'feedback_prompt:event-1:2026-04-01T11',
    title: 'How was your event?',
    body: 'Share quick feedback.',
    recipientCount: 1,
    recipients: [
      { email: 'user@example.com', userId: 'user-1', name: 'User One' },
    ],
    eventUrl: 'http://localhost:3000/events/event-1',
    feedbackUrl: 'http://localhost:3000/events/event-1#feedback',
    metadata: { attendeeIds: ['user-1'] },
  };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
      release: jest.fn().mockResolvedValue(undefined),
    };
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };
    mockRepo = {
      findOne: jest.fn(),
      findOneByOrFail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    mockRecipientInsertBuilder = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    mockRecipientRepo = {
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockRecipientInsertBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDeliveryService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: getRepositoryToken(NotificationDelivery),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(NotificationRecipientDelivery),
          useValue: mockRecipientRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationDeliveryService>(
      NotificationDeliveryService,
    );
    mockConfigService.get.mockReturnValue(undefined);
    mockRecipientRepo.find.mockResolvedValue([]);
  });

  it('sets attempts to 1 for newly created rows when attempts is undefined', async () => {
    const newRow = {
      attempts: undefined,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(newRow);
    mockRepo.save.mockResolvedValue(newRow);

    await service.send(payload);

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 1,
      }),
    );
  });

  it('increments attempts for existing rows', async () => {
    const existing = { id: 'delivery-1', delivered: false };
    const existingRow = {
      id: 'delivery-1',
      attempts: 2,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.findOneByOrFail.mockResolvedValue(existingRow);
    mockRepo.save.mockResolvedValue(existingRow);

    await service.send(payload);

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'delivery-1',
        attempts: 3,
      }),
    );
  });

  it('normalizes NaN attempts to 1 before save', async () => {
    const newRow = {
      attempts: Number.NaN,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(newRow);
    mockRepo.save.mockResolvedValue(newRow);

    await service.send(payload);

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 1,
      }),
    );
  });

  it('skips SMTP email when webhook channel is configured', async () => {
    const newRow = {
      attempts: 0,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(newRow);
    mockRepo.save.mockResolvedValue(newRow);
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NOTIFICATIONS_WEBHOOK_URL') return 'https://example.com/hook';
      if (key === 'SMTP_HOST') return 'smtp.example.com';
      return undefined;
    });
    const sendWebhookSpy = jest
      .spyOn(service as any, 'sendWebhook')
      .mockResolvedValue(undefined);
    const sendEmailSpy = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.send(payload);

    expect(sendWebhookSpy).toHaveBeenCalledTimes(1);
    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'webhook',
      }),
    );
  });

  it('uses SMTP email when webhook channel is not configured', async () => {
    const newRow = {
      attempts: 0,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(newRow);
    mockRepo.save.mockResolvedValue(newRow);
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'SMTP_HOST') return 'smtp.example.com';
      return undefined;
    });
    const sendWebhookSpy = jest
      .spyOn(service as any, 'sendWebhook')
      .mockResolvedValue(undefined);
    const sendEmailSpy = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.send(payload);

    expect(sendWebhookSpy).not.toHaveBeenCalled();
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'email',
      }),
    );
  });

  it('deduplicates recipients before dispatching channels', async () => {
    const newRow = {
      attempts: 0,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };
    const payloadWithDuplicates = {
      ...payload,
      recipients: [
        { email: 'User@Example.com', userId: 'u1', name: 'One' },
        { email: 'user@example.com', userId: 'u1', name: 'One Duplicate' },
      ],
      recipientCount: 2,
    };
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(newRow);
    mockRepo.save.mockResolvedValue(newRow);
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'SMTP_HOST') return 'smtp.example.com';
      return undefined;
    });
    const sendEmailSpy = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.send(payloadWithDuplicates);

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientCount: 1,
        recipients: [expect.objectContaining({ email: 'User@Example.com' })],
      }),
    );
  });

  it('suppresses already-delivered recipients across different idempotency keys', async () => {
    const firstRow = {
      attempts: 0,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };
    const secondRow = {
      attempts: 0,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };

    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValueOnce(firstRow).mockReturnValueOnce(secondRow);
    mockRepo.save.mockResolvedValue(firstRow);
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'SMTP_HOST') return 'smtp.example.com';
      return undefined;
    });
    mockRecipientRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ recipientKey: 'user:user-1' }]);
    const sendEmailSpy = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.send(payload);
    await service.send({
      ...payload,
      idempotencyKey: 'feedback_prompt:event-1:2026-04-01T12',
    });

    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'dedupe',
        delivered: true,
      }),
    );
  });
});
