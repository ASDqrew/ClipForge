import JobView from '@/components/job-view';
export default async function Page({params}:{params:Promise<{id:string}>}) {return <JobView id={(await params).id}/>}
