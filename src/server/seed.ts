import { db } from './firebaseAdmin';

export async function seedAgents() {
  console.log('[Firebase] Starting seedAgents check...');
  try {
    const agentsRef = db.collection('agents');
    const snapshot = await agentsRef.get();

    if (snapshot.empty) {
      console.log('[Firebase] Seeding default agents...');
      const defaultAgents = [
        {
          id: 'omni-core',
          name: 'Omni Core',
          mode: 'thinking',
          description: 'The primary sovereign intelligence of Omni. Handles complex architecture and planning.',
          capabilities: ['SourceGraph', 'Persistence', 'Execution'],
          status: 'online'
        },
        {
          id: 'omni-study',
          name: 'Omni Study',
          mode: 'socratic',
          description: 'A dedicated learning mentor that uses Socratic questioning to foster understanding.',
          capabilities: ['Explanation', 'Quizzing', 'Analogies'],
          status: 'online'
        },
        {
          id: 'omni-learning',
          name: 'Omni Learning',
          mode: 'roadmap',
          description: 'Monitors progress and suggests personalized learning roadmaps and improvements.',
          capabilities: ['Audit', 'Roadmapping', 'GapAnalysis'],
          status: 'online'
        }
      ];

      for (const agent of defaultAgents) {
        await agentsRef.doc(agent.id).set(agent);
      }
      console.log('[Firebase] Default agents seeded successfully.');
    } else {
      console.log(`[Firebase] Agents collection already exists (${snapshot.size} documents).`);
    }
  } catch (err: any) {
    console.error('[Firebase] Error in seedAgents:', err.message);
    if (err.code === 7 || err.message.includes('PERMISSION_DENIED')) {
      console.warn('[Firebase] PERMISSION_DENIED: Please ensure the Firestore database is provisioned and the service account has access.');
    }
    throw err;
  }
}
