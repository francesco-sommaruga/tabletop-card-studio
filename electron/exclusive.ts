// Serializes operations that read and mutate the open project's sets (IPC handlers, native file
// watcher, project open), so an automatic reload never interleaves with a save or its rollback.
// Never await runExclusive from inside a task that already runs in it: that would deadlock.
let tail: Promise<unknown> = Promise.resolve()

export function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = tail.then(task, task)
  tail = result.catch(() => undefined)
  return result
}
