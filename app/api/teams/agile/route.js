import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    // Extract params from the URL query params
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const agileId = searchParams.get('agileId');
    const roleId = searchParams.get('roleId');
    const type = searchParams.get('type'); // 新增type参数
    
    console.log('【API接收参数】', { teamId, agileId, roleId, type });
    
    // 根据type参数来决定返回什么数据
    if (teamId && type === 'agile') {
      // fetch team agile - 返回数组而不是单个记录
      const { data, error } = await supabase
        .from('team_agile')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('【API错误】获取团队敏捷数据失败:', error);
        throw error;
      }
      
      console.log(`【API响应】团队 ${teamId} 的敏捷数据:`, data ? data.length : 0, '条记录');
      // 确保总是返回数组
      return NextResponse.json(data || []);
    }
    
    if (teamId && type === 'roles') {
      // fetch agile roles
      const { data, error } = await supabase
        .from('agile_role')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('【API错误】获取敏捷角色失败:', error);
        throw error;
      }
      
      console.log(`【API响应】团队 ${teamId} 的角色数据:`, data ? data.length : 0, '条记录');
      return NextResponse.json(data || []);
    } 

    if (teamId && type === 'plans') {
      // fetch sprint plans
      const { data, error } = await supabase
        .from('sprint_plan')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('【API错误】获取冲刺计划失败:', error);
        throw error;
      }
      
      console.log(`【API响应】团队 ${teamId} 的冲刺计划数据:`, data ? data.length : 0, '条记录');
      return NextResponse.json(data || []);
    } 
    
    if (roleId) {
      // 通过ID获取特定角色
      const { data, error } = await supabase
        .from('agile_role')
        .select('*')
        .eq('id', roleId)
        .single();

      if (error) {
        console.error(`【API错误】获取角色 ${roleId} 失败:`, error);
        throw error;
      }
      
      console.log(`【API响应】角色 ${roleId} 数据:`, data ? '成功' : '无数据');
      return NextResponse.json(data || null);
    }
    
    if (agileId) {
      // fetch agile member with user information
      try {
        console.log(`【API请求】获取敏捷 ${agileId} 的成员`);
        
        // 首先获取敏捷成员
        const { data: memberData, error: memberError } = await supabase
          .from('agile_member')
          .select('*')
          .eq('agile_id', agileId)
          .order('created_at', { ascending: true });

        if (memberError) {
          console.error(`【API错误】获取敏捷 ${agileId} 成员失败:`, memberError);
          throw memberError;
        }

        // 如果没有成员，直接返回空数组
        if (!memberData || memberData.length === 0) {
          console.log(`【API响应】敏捷 ${agileId} 没有成员`);
          return NextResponse.json([]);
        }

        console.log(`【API】找到 ${memberData.length} 个敏捷成员`);
        
        // 获取所有成员的用户ID
        const userIds = memberData.map(member => member.user_id).filter(Boolean);
        
        // 如果没有用户ID，直接返回原始数据
        if (userIds.length === 0) {
          console.log(`【API响应】敏捷 ${agileId} 的成员中没有有效的用户ID`);
          return NextResponse.json(memberData);
        }

        console.log(`【API】查询 ${userIds.length} 个用户详情`);
        
        // 获取用户详细信息
        const { data: userData, error: userError } = await supabase
          .from('user')
          .select('*')
          .in('id', userIds);

        if (userError) {
          console.error('【API错误】获取用户详情失败:', userError);
          // 即使获取用户详情失败，也返回成员数据
          console.log(`【API响应】返回没有用户详情的敏捷成员`);
          return NextResponse.json(memberData);
        }

        if (!userData || userData.length === 0) {
          console.log(`【API响应】未找到用户详情，返回原始成员数据`);
          return NextResponse.json(memberData);
        }

        console.log(`【API】找到 ${userData.length} 个用户详情`);
        
        // 合并用户信息和成员信息
        const enrichedMembers = memberData.map(member => {
          const userInfo = userData?.find(user => user.id === member.user_id);
          if (userInfo) {
            return {
              ...member,
              name: userInfo.name,
              email: userInfo.email,
              avatar_url: userInfo.avatar_url
            };
          }
          return member;
        });

        console.log(`【API响应】返回 ${enrichedMembers.length} 个增强的敏捷成员`);
        return NextResponse.json(enrichedMembers);
      } catch (innerError) {
        console.error('【API错误】处理敏捷成员详情时出错:', innerError);
        // 返回空数组而不是错误，避免前端崩溃
        return NextResponse.json([], { status: 500 });
      }
    }

    // 如果没有匹配的条件，返回错误
    console.error('【API错误】无效的请求参数');
    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  } catch (error) {
    console.error('【API错误】处理请求时出错:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}