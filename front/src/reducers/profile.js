import produce from 'immer';
import { get, post } from 'common/requests';
import { filterBySearch } from 'utils/helpers';

// Action Types
export const GET_USERS = 'profile/GET_USERS';
export const GET_GROUPS = 'profile/GET_GROUPS';
export const UPDATE_SEARCH = 'profile/UPDATE_SEARCH';
export const UPDATE_FILTERED_USERS = 'profile/UPDATE_FILTERED_USERS';
export const UPDATE_NEW_USER = 'profile/UPDATE_NEW_USER';
export const UPDATE_ERROR = 'profile/UPDATE_ERROR';


// Reducer
const initialState = {
  search: '',
  users: [],
  filteredUsers: [],
  groups: [],
  newUser: {},
  error: null,
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    // eslint-disable-next-line default-case
    switch (action.type) {
      case GET_USERS:
        draft.users = action.profile;
        draft.filteredUsers = action.profile;
        break;
      case GET_GROUPS:
        draft.groups = action.groups;
        break;
      case UPDATE_SEARCH:
        draft.search = action.search;
        break;
      case UPDATE_FILTERED_USERS:
        draft.filteredUsers = action.filteredUsers;
        break;
      case UPDATE_NEW_USER:
        draft.newUser = action.newUser;
        break;
      case UPDATE_ERROR:
        draft.error = action.error;
        break;
    }
  });
}

// Actions Creators
function getUsersAction(profile) {
  return {
    type: GET_USERS,
    profile,
  };
}

function getGroupsAction(groups) {
  return {
    type: GET_GROUPS,
    groups,
  };
}

function updateSearchAction(search) {
  return {
    type: UPDATE_SEARCH,
    search,
  };
}

function updateFilteredUsersAction(filteredUsers) {
  return {
    type: UPDATE_FILTERED_USERS,
    filteredUsers,
  };
}

function updateNewUserAction(newUser) {
  return {
    type: UPDATE_NEW_USER,
    newUser,
  };
}

// Functions
function updateFilteredUsers() {
  return (dispatch, getState) => {
    const { profile } = getState();
    const { search, users } = profile;

    let filteredUsers = users;

    if (search !== '') {
      const firstNameSearch = filterBySearch(filteredUsers, search, 'firstName');
      const lastNameSearch = filterBySearch(filteredUsers, search, 'lastName');

      filteredUsers = [...new Set(firstNameSearch.concat(lastNameSearch))];
    }

    dispatch(updateFilteredUsersAction(filteredUsers));
  };
}

export function getUsers() {
  return async (dispatch) => {
    const users = await get('/user/');
    dispatch(getUsersAction(users));
    dispatch(updateFilteredUsers());
  };
}

export function getGroups() {
  return async (dispatch) => {
    const groups = await get('/group/');
    dispatch(getGroupsAction(groups));
  };
}

export function updateSearch(search) {
  return (dispatch) => {
    dispatch(updateSearchAction(search));
    dispatch(updateFilteredUsers());
  };
}

export function updateNewUser(newUser) {
  return (dispatch) => {
    dispatch(updateNewUserAction(newUser));
  };
}

export function updateError(error, errorMessage) {
  console.log(errorMessage);
  console.log(error.response.status, error.response.data);
  return (dispatch) => {
    dispatch({
      type: UPDATE_ERROR,
      error,
    });
  };
}

export function createUser(user, profile) {
  return async (dispatch) => {
    let createdUser = {};
    try {
      createdUser = await post('/user/', user);
      await post(`/user/${createdUser.id}/add_to_group`, profile);
      dispatch(getUsers());
    } catch (err) {
      dispatch(updateError(err, 'Create user Error'));
    }
    return createdUser;
  };
}

export function updateProfile(id, oldProfile, newProfile) {
  return async (dispatch) => {
    try {
      console.log(newProfile);
      await post(`/user/${id}/add_to_group`, newProfile);
      await post(`/user/${id}/remove_from_group`, oldProfile);
      dispatch(getUsers());
    } catch (err) {
      dispatch(updateError(err, 'Update profile Error'));
      return err;
    }
  };
}
