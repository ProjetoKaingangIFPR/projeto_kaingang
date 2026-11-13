import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tourSchema } from './tour-schema';
import { DEFAULT_TOUR } from './fixtures/defaultTour';
test('aceita o tour padrão e rejeita imagens embutidas e conexões inexistentes',()=>{
 assert.equal(tourSchema.safeParse(DEFAULT_TOUR).success,true);
 const tour=structuredClone(DEFAULT_TOUR);
 tour.points[0].panoramaUrl='data:image/png;base64,AAAA';
 assert.equal(tourSchema.safeParse(tour).success,false);
 tour.points[0].panoramaUrl='grand_atrium';tour.points[0].connectedPointIds=['missing'];
 assert.equal(tourSchema.safeParse(tour).success,false);
});
