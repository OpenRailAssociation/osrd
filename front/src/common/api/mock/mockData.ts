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
          { id: 1, grant: 'OWNER' },
          { id: 2, grant: 'OWNER' },
          { id: 3, grant: 'OWNER' },
        ],
        timetable: [{ id: 4, grant: 'OWNER' }],
      },
    },
    {
      type: 'user',
      id: 2,
      name: 'Monique Nguyen',
      roles: ['OperationalStudies'],
      resourcesGranted: {
        infra: [
          { id: 1, grant: 'READER' },
          { id: 2, grant: 'WRITER' },
          { id: 3, grant: 'READER' },
        ],
        timetable: [{ id: 2, grant: 'READER' }],
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
          { id: 2, grant: 'WRITER' },
          { id: 3, grant: 'OWNER' },
        ],
        timetable: [{ id: 12, grant: 'READER' }],
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
          { id: 3, grant: 'OWNER' },
          { id: 5, grant: 'WRITER' },
        ],
        timetable: [
          { id: 6, grant: 'WRITER' },
          { id: 9, grant: 'READER' },
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
          { id: 1, grant: 'READER' },
          { id: 5, grant: 'WRITER' },
          { id: 7, grant: 'READER' },
        ],
        timetable: [{ id: 4, grant: 'READER' }],
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
