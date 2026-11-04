export const SFTP_BLOCK_BYTES=65536;
export const SFTP_REQUEST_WINDOW=8;

/** Read fixed ranges concurrently, yield in file order, and handle short reads. */
export async function* readBlocks(call,handle,{start=0,end,signal,window=SFTP_REQUEST_WINDOW}={}) {
  if(!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start<0 || end<start || !Number.isInteger(window) || window<1 || window>SFTP_REQUEST_WINDOW) throw new Error('Invalid SFTP read range.');
  for(let position=start;position<end;) {
    signal?.throwIfAborted();const reads=[];
    for(let slot=0;slot<window && position<end;slot++) {
      const offset=position,length=Math.min(SFTP_BLOCK_BYTES,end-position);position+=length;
      reads.push((async()=>{
        const buffer=Buffer.alloc(length);let filled=0;
        while(filled<length) {
          signal?.throwIfAborted();const count=await call('read',handle,buffer,filled,length-filled,offset+filled);
          if(!Number.isInteger(count) || count<=0 || count>length-filled) throw Object.assign(new Error('SFTP source changed or ended early.'),{code:'TRANSFER_INTEGRITY'});
          filled+=count;
        }
        return buffer;
      })());
    }
    // Wait for every outstanding request before the caller can close the handle.
    const settled=await Promise.allSettled(reads),failed=settled.find(result=>result.status==='rejected');
    if(failed) throw failed.reason;
    for(const result of settled) {signal?.throwIfAborted();yield result.value;}
  }
}
