import { Job, Application } from '../types';
import { supabase, handleSupabaseError } from '../lib/supabase';

export const jobStorage = {
  getJobs: async (): Promise<Job[]> => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data?.map(job => ({
        id: job.id,
        farmerId: job.farmer_id,
        farmerName: job.farmer_name,
        title: job.title,
        description: job.description,
        preferredDate: job.preferred_date || '',
        wage: job.wage,
        duration: job.duration,
        durationType: job.duration_type,
        location: job.location,
        requiredWorkers: job.required_workers,
        acceptedWorkerIds: job.accepted_worker_ids || [],
        status: job.status,
        createdAt: job.created_at
      })) || [];
    } catch (error) {
      console.error('Error fetching jobs:', error);
      return [];
    }
  },
  
  saveJob: async (job: Job): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('jobs')
        .insert({
          farmer_id: job.farmerId,
          farmer_name: job.farmerName,
          title: job.title,
          description: job.description,
          preferred_date: job.preferredDate || null,
          wage: job.wage,
          duration: job.duration,
          duration_type: job.durationType,
          location: job.location,
          required_workers: job.requiredWorkers,
          status: job.status
        });
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) };
    }
  },
  
  updateJob: async (jobId: string, updates: Partial<Job>): Promise<{ success: boolean; error?: string }> => {
    try {
      const updateData: any = {};
      
      if (updates.wage !== undefined) updateData.wage = updates.wage;
      if (updates.requiredWorkers !== undefined) updateData.required_workers = updates.requiredWorkers;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.acceptedWorkerIds !== undefined) updateData.accepted_worker_ids = updates.acceptedWorkerIds;
      
      const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) };
    }
  },

  deleteJob: async (jobId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) };
    }
  }
};

export const applicationStorage = {
  getApplications: async (): Promise<Application[]> => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .order('applied_at', { ascending: false });
      
      if (error) throw error;
      
      return data?.map(app => ({
        id: app.id,
        jobId: app.job_id,
        workerId: app.worker_id,
        workerName: app.worker_name,
        workerEmail: app.worker_email,
        message: app.message || undefined,
        status: app.status,
        appliedAt: app.applied_at,
        rejectedAt: app.rejected_at || undefined
      })) || [];
    } catch (error) {
      console.error('Error fetching applications:', error);
      return [];
    }
  },
  
  saveApplication: async (application: Application): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('applications')
        .insert({
          job_id: application.jobId,
          worker_id: application.workerId,
          worker_name: application.workerName,
          worker_email: application.workerEmail,
          message: application.message || null,
          status: application.status,
          applied_at: application.appliedAt
        });
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) };
    }
  },
  
  updateApplication: async (applicationId: string, updates: Partial<Application>): Promise<{ success: boolean; error?: string }> => {
    try {
      const updateData: any = {};
      
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.appliedAt !== undefined) updateData.applied_at = updates.appliedAt;
      if (updates.rejectedAt !== undefined) updateData.rejected_at = updates.rejectedAt;
      
      const { error } = await supabase
        .from('applications')
        .update(updateData)
        .eq('id', applicationId);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) };
    }
  },

  getApplicationsForJob: async (jobId: string): Promise<Application[]> => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', jobId)
        .order('applied_at', { ascending: false });
      
      if (error) throw error;
      
      return data?.map(app => ({
        id: app.id,
        jobId: app.job_id,
        workerId: app.worker_id,
        workerName: app.worker_name,
        workerEmail: app.worker_email,
        message: app.message || undefined,
        status: app.status,
        appliedAt: app.applied_at,
        rejectedAt: app.rejected_at || undefined
      })) || [];
    } catch (error) {
      console.error('Error fetching job applications:', error);
      return [];
    }
  },

  getApplicationsForWorker: async (workerId: string): Promise<Application[]> => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('worker_id', workerId)
        .order('applied_at', { ascending: false });
      
      if (error) throw error;
      
      return data?.map(app => ({
        id: app.id,
        jobId: app.job_id,
        workerId: app.worker_id,
        workerName: app.worker_name,
        workerEmail: app.worker_email,
        message: app.message || undefined,
        status: app.status,
        appliedAt: app.applied_at,
        rejectedAt: app.rejected_at || undefined
      })) || [];
    } catch (error) {
      console.error('Error fetching worker applications:', error);
      return [];
    }
  }
};