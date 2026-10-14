// -----------------------------------------------------------------------------
// Device registry: every device of a snapshot, and back from a device to its
// student.
// -----------------------------------------------------------------------------

import { accountStates, buildAccountDevice } from './account.js';
import { buildStudentDevice, studentIds, studentStates } from './student.js';

/** The discovery payload of a snapshot: the account, then one device per student. */
export function buildDiscoveredDevices(gladys, snapshot) {
  if (!snapshot) {
    return [];
  }
  return [
    buildAccountDevice(gladys, snapshot.account),
    ...snapshot.students.map((student) => buildStudentDevice(gladys, snapshot.account, student)),
  ];
}

/** Every state of a snapshot, in the `publishStates` format. */
export function buildStates(gladys, snapshot, now, config) {
  if (!snapshot) {
    return [];
  }
  return [
    ...accountStates(gladys, snapshot.account),
    ...snapshot.students.flatMap((student) =>
      studentStates(gladys, snapshot.account, student, now, config),
    ),
  ];
}

/** The device external id of a student. */
export function studentDeviceId(gladys, snapshot, student) {
  return studentIds(gladys, snapshot.account, student).device;
}

/**
 * The student a device external id stands for. An empty id means "the first
 * student" (a widget nobody configured, a single-student account).
 */
export function findStudent(gladys, snapshot, externalId) {
  const students = snapshot?.students ?? [];
  if (!externalId) {
    return students[0] ?? null;
  }
  return (
    students.find((student) => studentDeviceId(gladys, snapshot, student) === externalId) ?? null
  );
}
