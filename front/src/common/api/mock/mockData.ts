import type { MockedDB } from './mockEditoastApi';

const database: MockedDB = {
  SUBJECTS: [
    {
      type: 'user',
      id: 1,
      name: 'Odile Roindolle',
      roles: ['admin'],
      resourcesGranted: {
        infra: [
          { id: 1, grant: 'READER' },
          { id: 2, grant: 'WRITER' },
          { id: 3, grant: 'OWNER' },
          { id: 4, grant: 'READER' },
          { id: 9, grant: 'WRITER' },
          { id: 10, grant: 'OWNER' },
        ],
        timetable: [{ id: 4, grant: 'OWNER' }],
        rollingstock: [
          { id: 3, grant: 'READER' },
          { id: 10, grant: 'WRITER' },
          { id: 105, grant: 'OWNER' },
          { id: 106, grant: 'READER' },
        ],
      },
    },
    {
      type: 'user',
      id: 2,
      name: 'Monique Nguyen',
      roles: ['OperationalStudies'],
      resourcesGranted: {
        infra: [
          { id: 1, grant: 'NONE' },
          { id: 2, grant: 'READER' },
          { id: 3, grant: 'READER' },
        ],
        timetable: [{ id: 2, grant: 'READER' }],
        rollingstock: [
          { id: 3, grant: 'OWNER' },
          { id: 10, grant: 'WRITER' },
          { id: 105, grant: 'NONE' },
          { id: 106, grant: 'WRITER' },
        ],
      },
    },
    {
      type: 'user',
      id: 3,
      name: 'André Lartigotte',
      roles: ['Stdcm'],
      resourcesGranted: {
        infra: [
          { id: 1, grant: 'READER' },
          { id: 2, grant: 'NONE' },
          { id: 3, grant: 'OWNER' },
        ],
        timetable: [{ id: 12, grant: 'READER' }],
        rollingstock: [
          { id: 3, grant: 'OWNER' },
          { id: 10, grant: 'WRITER' },
          { id: 105, grant: 'OWNER' },
          { id: 106, grant: 'NONE' },
        ],
      },
    },
    {
      type: 'user',
      id: 4,
      name: 'Pedro Tomaszewki',
      roles: ['OperationalStudies'],
      resourcesGranted: {
        infra: [
          { id: 1, grant: 'READER' },
          { id: 2, grant: 'OWNER' },
          { id: 5, grant: 'WRITER' },
        ],
        timetable: [
          { id: 6, grant: 'WRITER' },
          { id: 9, grant: 'READER' },
        ],
        rollingstock: [
          { id: 3, grant: 'NONE' },
          { id: 10, grant: 'NONE' },
          { id: 105, grant: 'READER' },
          { id: 106, grant: 'WRITER' },
        ],
      },
    },
    {
      type: 'user',
      id: 5,
      name: 'Victor Jacquinot',
      roles: ['Stdcm'],
      resourcesGranted: {
        infra: [
          { id: 1, grant: 'NONE' },
          { id: 5, grant: 'WRITER' },
          { id: 7, grant: 'READER' },
        ],
        timetable: [{ id: 4, grant: 'READER' }],
        rollingstock: [
          { id: 3, grant: 'READER' },
          { id: 10, grant: 'NONE' },
          { id: 105, grant: 'READER' },
          { id: 106, grant: 'WRITER' },
        ],
      },
    },
    {
      type: 'group',
      id: 6,
      name: 'stdcm users',
      roles: ['Stdcm'],
      resourcesGranted: {
        infra: [
          { id: 1, grant: 'READER' },
          { id: 5, grant: 'WRITER' },
          { id: 7, grant: 'WRITER' },
        ],
        timetable: [
          { id: 1, grant: 'READER' },
          { id: 2, grant: 'READER' },
        ],
        rollingstock: [
          { id: 3, grant: 'READER' },
          { id: 10, grant: 'WRITER' },
          { id: 105, grant: 'OWNER' },
          { id: 106, grant: 'READER' },
        ],
      },
    },
    {
      type: 'group',
      id: 7,
      name: 'operational studies users',
      roles: ['OperationalStudies'],
      resourcesGranted: {
        infra: [
          { id: 1, grant: 'READER' },
          { id: 2, grant: 'WRITER' },
          { id: 4, grant: 'OWNER' },
        ],
        timetable: [{ id: 3, grant: 'READER' }],
        rollingstock: [
          { id: 3, grant: 'READER' },
          { id: 10, grant: 'WRITER' },
          { id: 105, grant: 'OWNER' },
          { id: 106, grant: 'READER' },
        ],
      },
    },
  ],
  GRANTS: {
    READER: ['can_read', 'can_share_read'],
    WRITER: ['can_read', 'can_share_read', 'can_write', 'can_share_write'],
    OWNER: [
      'can_read',
      'can_share_read',
      'can_write',
      'can_share_write',
      'can_delete',
      'can_share_ownership',
    ],
  },
};

export default database;
