import { message } from "antd";
import axios from "axios";
import i18n from "i18next";
import { ramMin, cpuMin } from "../config/constants";
import AuthApi from "../services/openapi/src/api/AuthApi";
import CrashesApi from "../services/openapi/src/api/CrashesApi";
import FuzzersApi from "../services/openapi/src/api/FuzzersApi";
import IntegrationsApi from "../services/openapi/src/api/IntegrationsApi";
import PlatformConfigApi from "../services/openapi/src/api/PlatformConfigApi";
import ProjectImagesApi from "../services/openapi/src/api/ProjectImagesApi";
import ProjectsApi from "../services/openapi/src/api/ProjectsApi";
import PoolsApi from "../services/openapi/src/api/PoolsApi";
import RevisionsApi from "../services/openapi/src/api/RevisionsApi";
import SecurityApi from "../services/openapi/src/api/SecurityApi";
import StatisticsApi from "../services/openapi/src/api/StatisticsApi";
import UsersApi from "../services/openapi/src/api/UsersApi";
import ApiClient from "../services/openapi/src/ApiClient";

const apiClient = new ApiClient("/");
let tempCsrf = "";

function setCsrfToken() {
  apiClient.defaultHeaders = {
    "x-csrf-token": tempCsrf,
  };
}

export async function refreshCsrfToken() {
  try {
    const apiCall = new SecurityApi(apiClient);
    let response = await apiCall.refreshCsrfTokenWithHttpInfo();
    tempCsrf = response.response.header["x-csrf-token"];
  } catch (error) {
    const { t } = i18n;
    if (error?.body) {
      throw error.body;
    } else {
      return message.error(t("error.internal_server_error"));
    }
  }
}

//wrapper for csrf token failure retry and for error handling
function wrapper(fn) {
  return async function (...arg) {
    const { t } = i18n;
    let rsp = await fn(...arg);
    //if on first attempt got csrf token error
    if (
      rsp?.body?.code === "E_CSRF_TOKEN_MISSING" ||
      rsp?.body?.code === "E_CSRF_TOKEN_MISMATCH" ||
      rsp?.body?.code === "E_CSRF_TOKEN_INVALID"
    ) {
      await refreshCsrfToken();
      rsp = await fn(...arg);
    }

    if (rsp?.body) {
      throw rsp.body.error;
    } else if (rsp?.error) {
      return message.error(t("error.internal_server_error"));
    }

    //if action call got ok
    return await rsp;
  };
}

//-----------------AUTHENTICATION
export const loginUser = wrapper(async (dispatch, loginPayload) => {
  try {
    let response = await axios.post(`api/v1/auth/login`, {
      ...loginPayload,
    });
    let responseData = await response.data;
    let { user_id, display_name } = responseData;
    //let csrfCookie = response.headers["x-csrf-token"];
    let responseProjID = await getLastProjID(user_id);
    let payload = {
      user_id,
      display_name,
      proj_id: responseProjID?.id,
      proj_name: responseProjID?.name,
      proj_pool: responseProjID?.pool_id,
      //csrf_token: csrfCookie,
    };
    tempCsrf = response.headers["x-csrf-token"];
    dispatch({
      type: "LOGIN",
      payload: {
        ...payload,
      },
    });
    localStorage.setItem("currentUser", JSON.stringify(payload));
    return response.status;
  } catch (error) {
    if (error?.body) {
      return error;
    }
    //conditions below for axios-type errors
    else if (error.response.status === 500) {
      return { error: error };
    } else {
      return {
        body: {
          error: {
            ...error.response.data,
          },
        },
      };
    }
  }
});

//used on login to save default(last created) project to local storage
export async function getLastProjID(userId) {
  let apiCall = new ProjectsApi(apiClient);
  let resp = await apiCall.listProjects(userId);
  return resp.items[0];
}

export const logout = wrapper(async (dispatch) => {
  try {
    setCsrfToken();
    dispatch({ type: "LOGOUT" });
    localStorage.removeItem("currentUser");
    localStorage.removeItem("upgradeAlertShown");
    let apiCall = new AuthApi(apiClient);
    await apiCall.logout();
  } catch (error) {
    return error;
  }
});

//-----------------USER

export const getUser = wrapper(async () => {
  try {
    let apiCall = new UsersApi(apiClient);
    let resp = await apiCall.getSelfUser();
    return resp;
  } catch (error) {
    return error;
  }
});

export const updateUser = wrapper(async (userDetails, bodyPayload) => {
  try {
    setCsrfToken();
    let apiCall = new UsersApi(apiClient);
    let response = await apiCall.updateSelfUser({ ...bodyPayload });
  } catch (error) {
    return error;
  }
});

//-----------------PROJECT

export const countProjects = wrapper(async (userId, removalState) => {
  try {
    let apiCall = new ProjectsApi(apiClient);
    let response = await apiCall.getProjectCount(userId, {
      removalState: removalState,
    });
    return response.cnt_total;
  } catch (error) {
    return error;
  }
});

export const getProject = wrapper(async (userId, userProjectId) => {
  try {
    let apiCall = new ProjectsApi(apiClient);
    let resp = await apiCall.getProject(userId, userProjectId);
    return resp;
  } catch (error) {
    return error;
  }
});

export const fetchProjects = wrapper(async (userId, options) => {
  try {
    let apiCall = new ProjectsApi(apiClient);
    let { pageProps, removalState } = options;
    let resp = await apiCall.listProjects(userId, {
      ...pageProps,
      removalState,
    });
    return resp.items;
  } catch (error) {
    return error;
  }
});

export const createProject = wrapper(async (userDetails, bodyPayload) => {
  try {
    const { userId } = userDetails;
    setCsrfToken();
    let apiCall = new ProjectsApi(apiClient);
    let response = await apiCall.createProject(userId, {
      ...bodyPayload,
    });
    //returning newFuzzerId for Version to be created immediately after
    return response.id;
  } catch (error) {
    //throw error.body.error;
    return error;
  }
});

export const modifyProject = wrapper(
  async (userDetails, projectId, bodyPayload) => {
    try {
      const { userId } = userDetails;
      setCsrfToken();
      let apiCall = new ProjectsApi(apiClient);
      await apiCall.updateProject(projectId, userId, {
        ...bodyPayload,
      });
      //returning newFuzzerId for Version to be created immediately after
      //return response.result.id;
    } catch (error) {
      // throw error.body.error;
      return error;
    }
  }
);

export const modifyProjectPool = wrapper(
  async (userDetails, projectId, bodyPayload) => {
    try {
      const { userId } = userDetails;
      setCsrfToken();
      let apiCall = new ProjectsApi(apiClient);
      await apiCall.updateProjectPool(projectId, userId, {
        ...bodyPayload,
      });
      //returning newFuzzerId for Version to be created immediately after
      //return response.result.id;
    } catch (error) {
      //throw error.body.error;
      return error;
    }
  }
);

export const deleteProject = wrapper(async (userDetails, projectId) => {
  try {
    const { userId } = userDetails;
    setCsrfToken();
    let apiCall = new ProjectsApi(apiClient);
    let response = await apiCall.deleteProject(projectId, userId, "Delete");
  } catch (error) {
    return error;
  }
});

export const eraseProject = wrapper(async (userDetails, projectId) => {
  try {
    const { userId } = userDetails;
    setCsrfToken();
    const callApi = new ProjectsApi(apiClient);
    let resp = await callApi.deleteProject(projectId, userId, "Erase");
  } catch (error) {
    return error;
  }
});

export const emptyProjectBin = wrapper(async (userDetails) => {
  try {
    const { userId, userProjectId } = userDetails;
    setCsrfToken();
    const callApi = new ProjectsApi(apiClient);
    let resp = await callApi.emptyProjectTrashbin(userProjectId, userId);
  } catch (error) {
    return error;
  }
});

export const emptyUserBin = wrapper(async (userDetails) => {
  try {
    const { userId } = userDetails;
    setCsrfToken();
    const callApi = new ProjectsApi(apiClient);
    let resp = await callApi.emptyUserTrashbin(userId);
  } catch (error) {
    return error;
  }
});

export const restoreProject = wrapper(
  async (userDetails, projectId, newName) => {
    try {
      const { userId } = userDetails;
      setCsrfToken();
      const callApi = new ProjectsApi(apiClient);
      let resp = await callApi.deleteProject(projectId, userId, "Restore", {
        newName: newName ? newName : undefined,
      });
    } catch (error) {
      return error;
    }
  }
);

//-----------------POOL

export const fetchPools = wrapper(async (userId, dispatch) => {
  try {
    let apiCall = new PoolsApi(apiClient);
    let resp = await apiCall.listPools(userId);
    dispatch({
      type: "SET_POOLS",
      payload: { pools: resp.items },
    });
    return resp.items;
  } catch (error) {
    return error;
  }
});

//-----------------FUZZER
export const createFuzzer = wrapper(async (userDetails, bodyPayload) => {
  try {
    const { userId, userProjectId } = userDetails;
    setCsrfToken();
    let apiCall = new FuzzersApi(apiClient);
    let response = await apiCall.createFuzzer(userProjectId, userId, {
      ...bodyPayload,
    });
    //returning newFuzzerId for Version to be created immediately after
    return response.id;
  } catch (error) {
    return error;
  }
});

export const modifyFuzzer = wrapper(
  async (userDetails, fuzzerId, bodyPayload) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new FuzzersApi(apiClient);
      let response = await apiCall.updateFuzzer(
        userProjectId,
        fuzzerId,
        userId,
        {
          ...bodyPayload,
        }
      );
      //returning newFuzzerId for Version to be created immediately after
      return response.id;
    } catch (error) {
      return error;
    }
  }
);

export const getFuzzer = wrapper(async (userDetails, fuzzerId) => {
  try {
    const fuzzApi = new FuzzersApi(apiClient);
    const { userId, userProjectId } = userDetails;
    let response = await fuzzApi.getFuzzer(userProjectId, fuzzerId, userId);
    return response;
  } catch (error) {
    return error;
  }
});

export const fetchFuzzers = wrapper(async (dispatch, userDetails) => {
  try {
    const fuzzApi = new FuzzersApi(apiClient);
    const { userId, userProjectId } = userDetails;
    dispatch({ type: "FETCH_REQUEST" });
    let resp = await fuzzApi.listFuzzers(userProjectId, userId);
    dispatch({ type: "FETCH_SUCCESS", payload: resp.items });
  } catch (error) {
    dispatch({ type: "FETCH_ERROR" });
    return error;
  }
});

export const fetchFuzzersPage = wrapper(
  async (dispatch, projectId, userId, options) => {
    try {
      const fuzzApi = new FuzzersApi(apiClient);
      let { pageProps, removalState } = options;
      dispatch({ type: "FETCH_REQUEST" });
      let resp = await fuzzApi.listFuzzers(projectId, userId, {
        ...pageProps,
      });
      dispatch({ type: "FETCH_SUCCESS", payload: resp.items });
      return resp.items;
    } catch (error) {
      dispatch({ type: "FETCH_ERROR" });
      return error;
    }
  }
);

export const countFuzzers = wrapper(async (projectId, userId) => {
  try {
    const fuzzApi = new FuzzersApi(apiClient);
    let response = await fuzzApi.getFuzzerCount(projectId, userId);
    return response.cnt_total;
  } catch (error) {
    return error;
  }
});

export const setFconfs = wrapper(async (dispatch) => {
  try {
    const apiCall = new PlatformConfigApi(apiClient);
    let response = await apiCall.getPlatformConfig();

    let config = await response;
    let langsList = config.langs.map((lang) => {
      return { lang: lang.id };
    });
    let enginesList = {};
    langsList.forEach((lang) => {
      let thisEng = config.engines.filter((engine) =>
        engine.langs.includes(lang.lang)
      );
      let currLang = lang.lang;
      enginesList[currLang] = thisEng;
    });
    dispatch({
      type: "SET_FCONFS",
      payload: { fconfs: { langs: config.langs, engines: enginesList } },
    });
  } catch (error) {
    return error;
  }
});

//extract pool parameters for versions forms
export const getFuzzerLimits = wrapper(async (userDetails) => {
  try {
    const apiCall = new ProjectsApi(apiClient);
    const apiCallPool = new PoolsApi(apiClient);
    const { userId, userProjectId } = userDetails;
    let resp = await apiCall.getProject(userId, userProjectId);
    let pool = await apiCallPool.getPool(userId, resp.pool_id );
    // Преобразование структуры данных из API в формат, ожидаемый компонентами
    const resources = pool.resources;
    return {
      cpu: {
        min_value: cpuMin,
        max_value: resources.fuzzer_max_cpu || resources.cpu_total
      },
      ram: {
        min_value: ramMin,
        max_value: resources.fuzzer_max_ram || resources.ram_total
      },
      cpu_total: resources.cpu_total,
      ram_total: resources.ram_total,
      fuzzer_max_cpu: resources.fuzzer_max_cpu,
      fuzzer_max_ram: resources.fuzzer_max_ram,
      nodes_avail: resources.nodes_avail,
      nodes_total: resources.nodes_total
    };
  } catch (error) {
    return error;
  }
});

export const deleteFuzzer = wrapper(async (userDetails, fuzzerId) => {
  try {
    const { userId, userProjectId } = userDetails;
    setCsrfToken();
    let apiCall = new FuzzersApi(apiClient);
    let response = await apiCall.deleteFuzzer(
      fuzzerId,
      userId,
      userProjectId,
      "Delete"
    );
    return response;
  } catch (error) {
    return error;
  }
});

export const eraseFuzzer = wrapper(async (userDetails, fuzzerId) => {
  try {
    const { userId, userProjectId } = userDetails;
    setCsrfToken();
    let apiCall = new FuzzersApi(apiClient);
    let response = await apiCall.deleteFuzzer(
      fuzzerId,
      userId,
      userProjectId,
      "Erase"
    );
    //returning newFuzzerId for Version to be created immediately after
  } catch (error) {
    return error;
  }
});

export const cleanupFuzzer = wrapper(async (userDetails, fuzzerId) => {
  try {
    const { userId, userProjectId } = userDetails;
    setCsrfToken();
    let apiCall = new FuzzersApi(apiClient);
    let response = await apiCall.eraseFuzzerInTrashbin(
      userProjectId,
      fuzzerId,
      userId
    );
  } catch (error) {
    return error;
  }
});

export const restoreFuzzer = wrapper(async (userDetails, fuzzerId, newName) => {
  try {
    const { userId, userProjectId } = userDetails;
    setCsrfToken();
    const fuzzApi = new FuzzersApi(apiClient);
    let resp = await fuzzApi.deleteFuzzer(
      fuzzerId,
      userId,
      userProjectId,
      "Restore",
      {
        newName: newName ? newName : undefined,
      }
    );
  } catch (error) {
    return error;
  }
});

//fetch fuzzers, which is itself  in Trash or has at least one version in Trash
export const fetchFuzzersTrashBin = wrapper(async (userDetails) => {
  try {
    const fuzzApi = new FuzzersApi(apiClient);
    const { userId, userProjectId } = userDetails;
    let resp = await fuzzApi.listTrashbinFuzzers(userProjectId, userId);
    return resp.items;
  } catch (error) {
    return error;
  }
});

//-----------------VERSION

export const countVersions = wrapper(async (userDetails, currentFuzzId) => {
  try {
    const { userId, userProjectId } = userDetails;
    let apiCall = new RevisionsApi(apiClient);
    let response = await apiCall.getRevisionCount(
      currentFuzzId,
      userId,
      userProjectId
    );
    return response.cnt_total;
  } catch (error) {
    return error;
  }
});

// fetch versions and add them to reducer
export const fetchVersions = wrapper(
  async (dispatch, userDetails, currentFuzzId, options) => {
    try {
      const { userId, userProjectId } = userDetails;
      dispatch({ type: "FETCH_REQUEST" });
      let apiCall = new RevisionsApi(apiClient);
      let newRevisions = [];
      let { pageProps, removalState } = options;
      let response = await apiCall.listRevisions(
        currentFuzzId,
        userId,
        userProjectId,
        { ...pageProps, removalState }
      );
      response.items.forEach((el) => newRevisions.push(el));
      dispatch({ type: "FETCH_SUCCESS", payload: newRevisions });
      return newRevisions;
    } catch (error) {
      dispatch({ type: "FETCH_ERROR" });
      return error;
    }
  }
);

export const fetchVersionsForFilters = wrapper(
  async (userDetails, currentFuzzId, options) => {
    try {
      const { userId, userProjectId } = userDetails;
      let apiCall = new RevisionsApi(apiClient);
      let newRevisions = [];
      let { pageProps, removalState } = options;
      let response = await apiCall.listRevisions(
        currentFuzzId,
        userId,
        userProjectId,
        { ...pageProps, removalState }
      );
      response.items.forEach((el) => newRevisions.push(el));

      return newRevisions;
    } catch (error) {
      return error;
    }
  }
);

//extract image id from last created version of fuzzer
export const getLastVersionImage = wrapper(
  async (userDetails, currentFuzzId) => {
    try {
      const { userId, userProjectId } = userDetails;
      let apiCall = new RevisionsApi(apiClient);
      let response = await apiCall.listRevisions(
        currentFuzzId,
        userId,
        userProjectId,
        { pgSize: 10, removalState: "All" }
      );
      return response.items[0]?.image_id;
    } catch (error) {
      return error;
    }
  }
);

export const createVersion = wrapper(
  async (userDetails, currentFuzzId, bodyPayload) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new RevisionsApi(apiClient);
      let res = await apiCall.createRevision(
        userId,
        userProjectId,
        currentFuzzId,
        {
          ...bodyPayload,
        }
      );
      return res.id;
    } catch (error) {
      return error;
    }
  }
);

export const modifyVersion = wrapper(
  async (userDetails, fuzzerId, revisionId, bodyPayload) => {
    try {
      let { name, description, cpu_usage, ram_usage, tmpfs_size } = bodyPayload;
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new RevisionsApi(apiClient);
      // check if there is anything to submit Resources Info update
      if (description !== undefined || name) {
        let info = { description: description };

        if (name) {
          info.name = name;
        }
        await apiCall.updateRevisionInformation(
          revisionId,
          fuzzerId,
          userId,
          userProjectId,
          { ...info }
        );
      }
      //check if updateRevisionResources need to be sent as well
      if (cpu_usage || ram_usage || tmpfs_size) {
        await apiCall.updateRevisionResources(
          fuzzerId,
          revisionId,
          userId,
          userProjectId,
          { cpu_usage: cpu_usage, ram_usage: ram_usage, tmpfs_size: tmpfs_size }
        );
      }
    } catch (error) {
      return error;
    }
  }
);

export const uploadBinaries = wrapper(
  async (userDetails, currentFuzzId, revisionId, binaries) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new RevisionsApi(apiClient);
      await apiCall.uploadRevisionBinaries(
        revisionId,
        userId,
        userProjectId,
        currentFuzzId,
        binaries[0].originFileObj
      );
    } catch (error) {
      let { body } = error;
      body.type = "binaries";
      return { ...error, body };
    }
  }
);

export const uploadConfig = wrapper(
  async (userDetails, currentFuzzId, revisionId, config) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new RevisionsApi(apiClient);
      await apiCall.uploadRevisionConfig(
        revisionId,
        userId,
        userProjectId,
        currentFuzzId,
        config[0].originFileObj
      );
    } catch (error) {
      let { body } = error;
      body.type = "config";
      return { ...error, body };
    }
  }
);

export const uploadSeeds = wrapper(
  async (userDetails, currentFuzzId, revisionId, seeds) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new RevisionsApi(apiClient);
      await apiCall.uploadRevisionSeeds(
        revisionId,
        userId,
        userProjectId,
        currentFuzzId,
        seeds[0].originFileObj
      );
    } catch (error) {
      let { body } = error;
      body.error.type = "seeds";
      return { ...error, body };
    }
  }
);
export const deleteVersion = wrapper(
  async (userDetails, fuzzerId, revisionId) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new RevisionsApi(apiClient);
      let response = await apiCall.deleteRevision(
        revisionId,
        fuzzerId,
        userId,
        userProjectId,
        "Delete"
      );
    } catch (error) {
      return error;
    }
  }
);

export const eraseVersion = wrapper(
  async (userDetails, fuzzerId, revisionId) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new RevisionsApi(apiClient);
      await apiCall.deleteRevision(
        revisionId,
        fuzzerId,
        userId,
        userProjectId,
        "Erase"
      );
    } catch (error) {
      return error;
    }
  }
);

export const restoreVersion = wrapper(
  async (userDetails, fuzzerId, versionId, newName) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      const versionApi = new RevisionsApi(apiClient);
      await versionApi.deleteRevision(
        versionId,
        fuzzerId,
        userId,
        userProjectId,
        "Restore",
        {
          newName: newName ? newName : undefined,
        }
      );
    } catch (error) {
      return error;
    }
  }
);

//get images for provided combination of languages and engines
export const getImages = wrapper(async (userDetails, fuzzerType) => {
  try {
    const { userId, userProjectId } = userDetails;
    let langs = [];
    let engines = [];
    //langs.push(fuzzerLang);
    engines.push(fuzzerType);
    let apiCall = new ProjectImagesApi(apiClient);
    let response = await apiCall.listProjectImages(userProjectId, userId, {
      //langs: langs,
      engines: engines,
    });

    return response.items;
  } catch (error) {
    return error;
  }
});

//-----------------VERSION STATUS MANAGEMENT

export const startFuzzer = wrapper(async (userDetails, fuzzerId) => {
  try {
    const { userId, userProjectId } = userDetails;
    setCsrfToken();
    let apiCall = new FuzzersApi(apiClient);
    let response = await apiCall.startFuzzer(fuzzerId, userId, userProjectId);
    return response;
  } catch (error) {
    return error;
  }
});

export const restartFuzzer = wrapper(async (userDetails, fuzzerId) => {
  try {
    const { userId, userProjectId } = userDetails;
    setCsrfToken();
    let apiCall = new FuzzersApi(apiClient);
    let response = await apiCall.restartFuzzer(fuzzerId, userId, userProjectId);
  } catch (error) {
    return error;
  }
});

export const stopFuzzer = wrapper(async (userDetails, fuzzerId) => {
  try {
    const { userId, userProjectId } = userDetails;
    setCsrfToken();
    let apiCall = new FuzzersApi(apiClient);
    let response = await apiCall.stopFuzzer(fuzzerId, userId, userProjectId);
  } catch (error) {
    return error;
  }
});

export const startVersion = wrapper(
  async (userDetails, fuzzerId, revisionId) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new RevisionsApi(apiClient);
      let response = await apiCall.startRevision(
        revisionId,
        userId,
        userProjectId,
        fuzzerId
      );
    } catch (error) {
      return error;
    }
  }
);

export const restartVersion = wrapper(
  async (userDetails, fuzzerId, revisionId) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new RevisionsApi(apiClient);
      let response = await apiCall.restartRevision(
        revisionId,
        userId,
        userProjectId,
        fuzzerId
      );
    } catch (error) {
      return error;
    }
  }
);

export const stopVersion = wrapper(
  async (userDetails, fuzzerId, revisionId) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new RevisionsApi(apiClient);
      let response = await apiCall.stopRevision(
        revisionId,
        userId,
        userProjectId,
        fuzzerId
      );
    } catch (error) {
      return error;
    }
  }
);

//-----------------CRASH

export const fetchCrashesForFuzzer = wrapper(
  async (userDetails, fuzzerId, options) => {
    try {
      const crashApi = new CrashesApi(apiClient);
      const { userId, userProjectId } = userDetails;
      const { dateToFetch, pageProps, reproduced, archived } = options;

      let resp = await crashApi.listFuzzerCrashes(
        fuzzerId,
        userId,
        userProjectId,
        { ...dateToFetch, ...pageProps, reproduced, archived }
      );
      return resp.items;
    } catch (error) {
      return error;
    }
  }
);

export const countCrashesForFuzzerFiltered = wrapper(
  async (userDetails, fuzzerId, options) => {
    try {
      const crashApi = new CrashesApi(apiClient);
      const { userId, userProjectId } = userDetails;
      //reproduced and actual will be added
      let dateFilter = options?.dateToFetch ? { ...options.dateToFetch } : {};
      let reproduced =
        options?.reproduced === undefined ? undefined : options.reproduced;
      let archived =
        options?.archived === undefined ? undefined : options.archived;
      let resp = await crashApi.countFuzzerCrashes(
        fuzzerId,
        userId,
        userProjectId,
        { ...dateFilter, reproduced, archived }
      );

      return resp.cnt_total;
    } catch (error) {
      return error;
    }
  }
);

export const fetchCrashesForVersion = wrapper(
  async (userDetails, fuzzerId, versionId, options) => {
    try {
      const crashApi = new CrashesApi(apiClient);
      const { userId, userProjectId } = userDetails;
      const { dateToFetch, pageProps, reproduced, archived } = options;
      let resp = await crashApi.listRevisionCrashes(
        versionId,
        userId,
        userProjectId,
        fuzzerId,
        { ...dateToFetch, ...pageProps, reproduced, archived }
      );
      return resp.items;
    } catch (error) {
      return error;
    }
  }
);

export const countCrashesForVersionFiltered = wrapper(
  async (userDetails, fuzzerId, versionId, options) => {
    try {
      const crashApi = new CrashesApi(apiClient);
      const { userId, userProjectId } = userDetails;
      let dateFilter = options?.dateToFetch ? options.dateToFetch : {};
      let reproduced =
        options?.reproduced === undefined ? undefined : options.reproduced;
      let archived =
        options?.archived === undefined ? undefined : options.archived;
      let resp = await crashApi.countRevisionCrashes(
        versionId,
        userId,
        userProjectId,
        fuzzerId,
        { ...dateFilter, reproduced, archived }
      );

      return resp.cnt_total;
    } catch (error) {
      return error;
    }
  }
);

export const moveCrash = wrapper(
  async (userDetails, fuzzerId, crashId, archived) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      const crashApi = new CrashesApi(apiClient);
      await crashApi.changeCrashArchived(
        fuzzerId,
        crashId,
        userId,
        userProjectId,
        archived
      );
    } catch (error) {
      return error;
    }
  }
);

export const downloadCrash = wrapper(async (userDetails, fuzzerId, crashId) => {
  try {
    let fuzzApi = new FuzzersApi(apiClient);
    const { userId, userProjectId } = userDetails;
    let fuzzer = await fuzzApi.getFuzzer(userProjectId, fuzzerId, userId);
    await axios({
      url: `api/v1/users/${userId}/projects/${userProjectId}/fuzzers/${fuzzerId}/crashes/${crashId}/raw`,
      baseURL: "/",
      method: "GET",
      responseType: "blob",
    }).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${fuzzer.name}_${crashId}.crash`); //or any other extension
      document.body.appendChild(link);
      link.click();
    });
  } catch (error) {
    if (error?.body?.error) {
      return error;
    }
    //conditions below for axios-type errors
    else if (error.response.status === 500) {
      return { error: error };
    } else {
      let errorResult = JSON.parse(await error.response.data.text());
      return {
        body: {
          error: {
            ...errorResult.error,
          },
        },
      };
    }
  }
});

export const downloadFuzzerCorpus = wrapper(async (userDetails, fuzzerId) => {
  try {
    let fuzzApi = new FuzzersApi(apiClient);
    const { userId, userProjectId } = userDetails;
    let fuzzer = await fuzzApi.getFuzzer(userProjectId, fuzzerId, userId);
    await axios({
      url: `api/v1/users/${userId}/projects/${userProjectId}/fuzzers/${fuzzerId}/files/corpus`,
      baseURL: "/",
      method: "GET",
      responseType: "blob",
    }).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${fuzzer.name}_corpus.tar.gz`); //or any other extension
      document.body.appendChild(link);
      link.click();
    });
  } catch (error) {
    // let errorResult = JSON.parse(await error.response.data.text());
    // throw errorResult.error;
    if (error?.body?.error) {
      return error;
    }
    //conditions below for axios-type errors
    else if (error.response.status === 500) {
      return { error: error };
    } else {
      let errorResult = JSON.parse(await error.response.data.text());
      return {
        body: {
          error: {
            ...errorResult.error,
          },
        },
      };
    }
  }
});

export const downloadVersionFiles = wrapper(
  async (userDetails, fuzzerId, revision_id, fileType) => {
    try {
      let fuzzApi = new FuzzersApi(apiClient);
      const { userId, userProjectId } = userDetails;
      let fuzzer = await fuzzApi.getFuzzer(userProjectId, fuzzerId, userId);
      await axios({
        url: `api/v1/users/${userId}/projects/${userProjectId}/fuzzers/${fuzzerId}/revisions/${revision_id}/files/${fileType}`,
        baseURL: "/",
        method: "GET",
        responseType: "blob",
      }).then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          fileType === "config"
            ? `${fuzzer.name}_${revision_id}_${fileType}.json`
            : `${fuzzer.name}_${revision_id}_${fileType}.tar.gz`
        ); //or any other extension
        document.body.appendChild(link);
        link.click();
      });
    } catch (error) {
      if (error?.body?.error) {
        return error;
      }
      //conditions below for axios-type errors
      else if (error.response.status === 500) {
        return { error: error };
      } else {
        let errorResult = JSON.parse(await error.response.data.text());
        return {
          body: {
            error: {
              ...errorResult.error,
            },
          },
        };
      }
    }
  }
);

//-----------------STATISTIC

// group by predefined -'day'
export const fetchStatisticsForFuzzer = wrapper(
  async (userDetails, fuzzerId, period) => {
    try {
      const statApi = new StatisticsApi(apiClient);
      const { userId, userProjectId } = userDetails;
      const { dateBegin, dateEnd } = period;
      let resp = await statApi.listFuzzerStatistics(
        userId,
        userProjectId,
        fuzzerId,
        "day",
        { dateBegin, dateEnd }
      );
      return resp.items;
    } catch (error) {
      // return [];
      return error;
    }
  }
);

// group by predefined - 'day'
export const fetchStatisticsForVersion = wrapper(
  async (userDetails, fuzzerId, versionId, period) => {
    try {
      const statApi = new StatisticsApi(apiClient);
      const { userId, userProjectId } = userDetails;
      const { dateBegin, dateEnd } = period;
      let resp = await statApi.listRevisionStatistics(
        userId,
        userProjectId,
        fuzzerId,
        versionId,
        "day",
        { dateBegin, dateEnd }
      );
      return resp.items;
    } catch (error) {
      //return [];
      return error;
    }
  }
);

export const countStatisticsForFuzzer = wrapper(
  async (userDetails, fuzzerId) => {
    try {
      const statApi = new StatisticsApi(apiClient);
      const { userId, userProjectId } = userDetails;
      let resp = await statApi.countFuzzerStatisticsRecords(
        userId,
        userProjectId,
        fuzzerId,
        "day"
      );
      return resp.cnt_total;
    } catch (error) {
      //return [];
      return error;
    }
  }
);

export const countStatisticsForVersion = wrapper(
  async (userDetails, fuzzerId, versionId) => {
    try {
      const statApi = new StatisticsApi(apiClient);
      const { userId, userProjectId } = userDetails;
      let resp = await statApi.countRevisionStatisticsRecords(
        userId,
        userProjectId,
        fuzzerId,
        versionId,
        "day"
      );
      return resp.cnt_total;
    } catch (error) {
      //return [];
      return error;
    }
  }
);

////-----------------INTEGRATIONS

export const countIntegrations = wrapper(async (userProjectId, userId) => {
  try {
    let apiCall = new IntegrationsApi(apiClient);
    let response = await apiCall.getCountOfBugTrackerIntegrations(
      userProjectId,
      userId
    );
    return response.cnt_total;
  } catch (error) {
    // throw error.body.error;
    return error;
  }
});

export const fetchIntegrationsPage = wrapper(
  async (userProjectId, userId, options) => {
    try {
      let { pageProps, removalState } = options;
      let apiCall = new IntegrationsApi(apiClient);
      let response = await apiCall.listIntegrations(userProjectId, userId, {
        ...pageProps,
      });
      return response.items;
    } catch (error) {
      return error;
    }
  }
);
// if toggle is separated from update  method in API
// export const toggleIntegration = wrapper(
//   async (userDetails, integrationId, enabled) => {
//     try {
//       console.log("toggleIntegration", enabled);
//       const { userId, userProjectId } = userDetails;
//       setCsrfToken();
//       let apiCall = new IntegrationsApi(apiClient);
//       let response = await apiCall.changeBugTrackerIntegrationEnabled(
//         integrationId,
//         userProjectId,
//         userId,
//         { enabled: enabled }
//       );
//     } catch (error) {
//       return error;
//     }
//   }
// );

export const toggleIntegration = wrapper(
  async (userDetails, integrationId, enabled) => {
    try {
      const { userId, userProjectId } = userDetails;
      setCsrfToken();
      let apiCall = new IntegrationsApi(apiClient);
      let response = await apiCall.updateBugTrackerIntegration(
        integrationId,
        userProjectId,
        userId,
        { enabled }
      );
    } catch (error) {
      return error;
    }
  }
);

export const createIntegration = wrapper(
  async (userDetails, projectId, bodyPayload) => {
    try {
      const { userId } = userDetails;
      setCsrfToken();
      let apiCall = new IntegrationsApi(apiClient);
      let response = await apiCall.createBugTrackerIntegration(
        projectId,
        userId,
        {
          ...bodyPayload,
        }
      );
      //return response.result.id;
    } catch (error) {
      //throw error.body.error;
      return error;
    }
  }
);

export const getIntegrationConfig = wrapper(
  async (projectId, userId, integrationId) => {
    try {
      let apiCall = new IntegrationsApi(apiClient);
      let config = await apiCall.getBugTrackerIntegrationConfig(
        integrationId,
        projectId,
        userId
      );
      return config;
    } catch (error) {
      return error;
    }
  }
);

export const modifyIntegration = wrapper(
  async (userDetails, projectId, integrationId, bodyPayload) => {
    try {
      const { userId } = userDetails;
      setCsrfToken();
      let apiCall = new IntegrationsApi(apiClient);
      await apiCall.updateBugTrackerIntegration(
        integrationId,
        projectId,
        userId,
        {
          ...bodyPayload,
        }
      );
    } catch (error) {
      return error;
    }
  }
);

export const modifyIntegrationConfig = wrapper(
  async (userDetails, projectId, integrationId, bodyPayload) => {
    try {
      const { userId } = userDetails;
      setCsrfToken();
      let apiCall = new IntegrationsApi(apiClient);
      await apiCall.updateBugTrackerIntegrationConfig(
        integrationId,
        projectId,
        userId,
        {
          ...bodyPayload,
        }
      );
    } catch (error) {
      return error;
    }
  }
);

export const deleteIntegration = wrapper(async (userDetails, integrationId) => {
  try {
    const { userId, userProjectId } = userDetails;
    setCsrfToken();
    let apiCall = new IntegrationsApi(apiClient);
    let response = await apiCall.deleteIntegration(
      integrationId,
      userProjectId,
      userId
    );
  } catch (error) {
    return error;
  }
});

///-----------------LOCAL FUNCTIONS

export async function switchCurrentProject(dispatch, userDetails, project) {
  try {
    dispatch({
      type: "SWITCH_PROJECT",
      payload: {
        proj_id: project.id,
        proj_name: project.name,
        proj_pool: project.pool_id,
      },
    });
    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        user_id: userDetails.userId,
        display_name: userDetails.userDisplayName,
        proj_id: project.id,
        proj_name: project.name,
        proj_pool: project.pool_id,
      })
    );
    return "success";
  } catch (error) {
    return error.body.error.message;
  }
}

export async function updateDisplayName(dispatch, displayName) {
  try {
    dispatch({
      type: "RENAME",
      payload: {
        display_name: displayName,
      },
    });
    let temp = JSON.parse(localStorage["currentUser"]);
    localStorage.setItem(
      "currentUser",
      JSON.stringify({ ...temp, display_name: displayName })
    );
  } catch (error) {
    return error.body.error.message;
  }
}
