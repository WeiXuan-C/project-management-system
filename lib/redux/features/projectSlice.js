import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '@/lib/api'

// Async thunks
export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async () => {
    const res = await api.projects.list()
    return res;
  }
)

export const fetchProjectById = createAsyncThunk(
  'projects/fetchProjectById', 
  async (projectId) => {
    if (!projectId) {
      throw new Error('Project ID is required'); // 添加检查
    }
    const res = await api.projects.getById(projectId);
    if (!res) {
      throw new Error('Project not found');
    }
    return Array.isArray(res) ? res[0] : res;
  }
)

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (projectData) => {
    const res = await api.projects.create(projectData)
    return res; //确保返回promise
  }
)

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async ({ projectId, projectData }) => {
    const res = await api.projects.update(projectId, projectData)
    return res;
  }
)

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (projectId) => {
    await api.projects.delete(projectId)
    return projectId;
  }
)

export const fetchUserProjects = createAsyncThunk(
  'projects/fetchUserProjects',
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.projects.listByUser(userId);
      return res;
    } catch (error) {
      console.error('获取用户项目失败:', error);
      return rejectWithValue(error.message);
    }
  }
)

export const archiveProject = createAsyncThunk(
  'projects/archiveProject',
  async (projectId) => {
    const res = await api.projects.update(projectId, { archived: true })
    return res;
  }
)

export const restoreProject = createAsyncThunk(
  'projects/restoreProject',
  async (projectId) => {
    const res = await api.projects.update(projectId, { archived: false })
    return res;
  }
)

const projectSlice = createSlice({
  name: 'projects',
  initialState: {
    projects: [],
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    showArchived: false, // 默认不显示已归档项目
  },
  reducers: {
    updateProjectOrder(state, action) {
      state.projects = action.payload;
    },
    clearProjects(state) {
      state.projects = [];
      state.status = 'idle';
      state.error = null;
    },
    toggleShowArchived(state) {
      state.showArchived = !state.showArchived;
    },
    setShowArchived(state, action) {
      state.showArchived = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.projects = action.payload
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
      .addCase(fetchProjectById.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchProjectById.fulfilled, (state, action) => {
        state.status = 'succeeded'
        const existingProject = state.projects.find(project => project.id === action.payload.id);
        if (!existingProject) {
          state.projects.push(action.payload); // 如果项目不存在，则添加到项目列表
        }
      })
      .addCase(fetchProjectById.rejected, (state, action) => {
        state.error = action.error.message; // 处理错误
      })
      .addCase(createProject.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.projects.push(action.payload)
      })
      .addCase(createProject.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
      .addCase(updateProject.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.status = 'succeeded'
        const index = state.projects.findIndex(project => project.id === action.payload.id)
        if (index !== -1) {
          state.projects[index] = action.payload
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
      .addCase(deleteProject.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.projects = state.projects.filter(project => project.id !== action.payload)
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
      .addCase(fetchUserProjects.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchUserProjects.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.projects = action.payload
      })
      .addCase(fetchUserProjects.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
      .addCase(archiveProject.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(archiveProject.fulfilled, (state, action) => {
        state.status = 'succeeded'
        const index = state.projects.findIndex(project => project.id === action.payload.id)
        if (index !== -1) {
          state.projects[index] = action.payload
        }
      })
      .addCase(archiveProject.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
      .addCase(restoreProject.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(restoreProject.fulfilled, (state, action) => {
        state.status = 'succeeded'
        const index = state.projects.findIndex(project => project.id === action.payload.id)
        if (index !== -1) {
          state.projects[index] = action.payload
        }
      })
      .addCase(restoreProject.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
  },
})

export const { updateProjectOrder, clearProjects, toggleShowArchived, setShowArchived } = projectSlice.actions
export default projectSlice.reducer
