import { prisma } from '../db/client.js';
import { log as audit } from './auditService.js';

export async function listTags() {
  return prisma.tag.findMany({ orderBy: { name: 'asc' } });
}

export async function createTag({ name, color }, actorId) {
  const tag = await prisma.tag.create({ data: { name, color: color || '#8B5CF6' } });
  await audit({ userId: actorId, action: 'TAG_CREATED', resource: 'tag', resourceId: tag.id, meta: { name } });
  return tag;
}

export async function updateTag(id, data, actorId) {
  const allowed = {};
  if (data.name) allowed.name = data.name;
  if (data.color) allowed.color = data.color;
  const tag = await prisma.tag.update({ where: { id }, data: allowed });
  await audit({ userId: actorId, action: 'TAG_UPDATED', resource: 'tag', resourceId: id, meta: allowed });
  return tag;
}

export async function deleteTag(id, actorId) {
  await prisma.tag.delete({ where: { id } });
  await audit({ userId: actorId, action: 'TAG_DELETED', resource: 'tag', resourceId: id });
}

export async function assignTag(recordingId, tagId, actorId) {
  await prisma.recordingTag.upsert({
    where: { recordingId_tagId: { recordingId, tagId } },
    update: {},
    create: { recordingId, tagId }
  });
  await audit({ userId: actorId, action: 'TAG_ASSIGNED', resource: 'recording', resourceId: recordingId, meta: { tagId } });
}

export async function removeTag(recordingId, tagId, actorId) {
  await prisma.recordingTag.delete({ where: { recordingId_tagId: { recordingId, tagId } } });
  await audit({ userId: actorId, action: 'TAG_REMOVED', resource: 'recording', resourceId: recordingId, meta: { tagId } });
}
