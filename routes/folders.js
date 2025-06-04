const db = require('../database/db');

async function foldersRoutes(fastify, options) {
  // Require authentication for all routes
  fastify.addHook('preHandler', fastify.requireAuth);

  // Delete a folder and all its contents
  fastify.delete('/folder/:id', async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    try {
      // Check if folder exists and belongs to user
      const folderQuery = `
        SELECT * FROM folders 
        WHERE id = $1 AND user_id = $2
      `;
      const result = await db.query(folderQuery, [id, userId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Folder not found' });
      }

      // Delete folder (cascade will handle files and subfolders)
      const deleteQuery = `DELETE FROM folders WHERE id = $1`;
      await db.query(deleteQuery, [id]);

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to delete folder' });
    }
  });
  // Rename a folder
  fastify.put('/folder/:id', async (request, reply) => {
    const { id } = request.params;
    const { name } = request.body;
    const userId = request.userId;

    if (!name) {
      return reply.code(400).send({ error: 'Folder name is required' });
    }

    try {
      // Check if folder exists and belongs to user
      const folderQuery = `
        SELECT * FROM folders 
        WHERE id = $1 AND user_id = $2
      `;
      const result = await db.query(folderQuery, [id, userId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Folder not found' });
      }

      const folder = result.rows[0];
      
      // Update path
      const pathParts = folder.path.split('/');
      pathParts[pathParts.length - 1] = name;
      const newPath = pathParts.join('/');

      // Update folder
      const updateQuery = `
        UPDATE folders 
        SET name = $1, path = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      
      const updateResult = await db.query(updateQuery, [name, newPath, id]);

      return { folder: updateResult.rows[0] };
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        return reply.code(409).send({ error: 'Folder name already exists' });
      }
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to rename folder' });
    }
  });
}

module.exports = foldersRoutes;
