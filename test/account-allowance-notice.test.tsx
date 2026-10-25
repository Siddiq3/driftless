import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {AccountAllowanceNotice} from '@/sync/AccountAllowanceNotice';
import {selectStorageScope} from '@/db/scope';
import {Tracking} from 'tracking-android';
jest.mock('tracking-android',()=>({Tracking:{accountUsageInfo:jest.fn(),health:()=>({apps:[]})}}));
jest.mock('@/ui/kit',()=>({Notice:({title,body}:{title:string;body:string})=>{
  const React=require('react'),{Text}=require('react-native');
  return React.createElement(Text,null,`${title} ${body}`);
}}));
let root:ReactTestRenderer;
const render=async()=>{await act(async()=>{root=create(<AccountAllowanceNotice/>);});return JSON.stringify(root.toJSON());};
beforeEach(()=>{selectStorageScope('account:fixture');jest.mocked(Tracking.accountUsageInfo).mockReturnValue({active:true,tz:'America/New_York',status:'reserved_stale',cutoffMs:0,resetGeneration:0,nowMs:1,limits:{minutes:600000,views:20},used:{minutes:null,views:0}});});
afterEach(async()=>{if(root) await act(async()=>root.unmount());selectStorageScope('legacy');});
it('distinguishes unknown minutes from measured zero views and explains stale reserved credit',async()=>{
  const text=await render();expect(text).toContain('Minutes: unavailable / 10');expect(text).toContain('Videos: 0 / 20');
  expect(text).toContain('Snapshot is stale');expect(text).toContain('America/New_York');expect(text).toContain('next account day');
});
it('shows the selected account timezone during the initial local-rule transition',async()=>{
  jest.mocked(Tracking.accountUsageInfo).mockReturnValue({active:false,tz:'Asia/Tokyo',accountTz:'America/New_York',status:'transition',cutoffMs:0,resetGeneration:0,nowMs:1});
  const text=await render();expect(text).toContain('America/New_York');expect(text).not.toContain('Asia/Tokyo');
});
it('does not show a previous account allowance in guest mode',async()=>{
  selectStorageScope('guest:fixture');expect(await render()).toBe('null');
});

it('shows remaining reserved credit without implying the whole account balance is usable offline', async () => {
  jest
    .mocked(Tracking.accountUsageInfo)
    .mockReturnValue({
      active: true,
      tz: 'UTC',
      status: 'credit_exhausted',
      cutoffMs: 0,
      resetGeneration: 0,
      nowMs: 1,
      limits: { views: 20 },
      used: { views: 20 },
      remaining: { views: 0 },
    });
  const text = await render();
  expect(text).toContain('reserved on this phone: 0');
  expect(text).toContain('credit exhausted');
});
