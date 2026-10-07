export async function trashPaths(paths,allowed,deleteFile) {
  for (const path of paths) {
    if (!allowed()) throw new Error('Löschfreigabe wurde zurückgenommen.');
    await deleteFile(path,{recursive:true,useTrash:true});
  }
}
