// Ziyaretçi hesabı uçları: /api/account/*. Oturum yalnızca HttpOnly çerezde taşınır.
import { Router } from 'express';
import * as acc from '../accounts.js';

export const accountRoutes = Router();

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };
const me = (req, res) => { req.viewer = undefined; res.json(acc.meDto(acc.viewerOf(req))); };

accountRoutes.get('/account/me', (req, res) => res.json(acc.meDto(acc.viewerOf(req))));
accountRoutes.get('/account/providers', (_req, res) => res.json({ google: acc.googleEnabled() }));

accountRoutes.post('/account/register', wrap((req, res) => { acc.register(req, res, req.body ?? {}); me(req, res); }));
accountRoutes.post('/account/login', wrap((req, res) => { acc.login(req, res, req.body ?? {}); me(req, res); }));
accountRoutes.post('/account/guest', wrap((req, res) => { acc.guest(req, res, req.body ?? {}); me(req, res); }));
accountRoutes.post('/account/logout', (req, res) => { acc.logout(req, res); res.json({ kind: 'anonymous' }); });
accountRoutes.post('/account/logout-all', (req, res) => { acc.logoutEverywhere(req, res); res.json({ kind: 'anonymous' }); });
accountRoutes.patch('/account/profile', wrap((req, res) => { acc.updateProfile(req, req.body ?? {}); res.json(acc.meDto(acc.viewerOf(req))); }));
accountRoutes.post('/account/password', wrap((req, res) => { acc.changePassword(req, res, req.body ?? {}); res.status(204).end(); }));

accountRoutes.get('/account/saved', wrap((req, res) => res.json(acc.savedList(req))));
accountRoutes.put('/account/saved/:id', wrap((req, res) => { acc.savedPut(req, req.params.id, req.body); res.status(204).end(); }));
accountRoutes.delete('/account/saved/:id', wrap((req, res) => { acc.savedDelete(req, req.params.id); res.status(204).end(); }));

accountRoutes.get('/account/google', wrap((req, res) => acc.googleStart(req, res)));
accountRoutes.get('/account/google/callback', wrap((req, res) => acc.googleCallback(req, res)));
