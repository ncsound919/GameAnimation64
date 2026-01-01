/**
* @copyright 2024 - Max Bebök
* @license MIT
*/
#include "renderer/particles/ptxSprites.h"
#include "debug/debugDraw.h"

namespace
{
  constexpr float BASE_SCALE = 100.0f;
  constexpr float BASE_SCALE_INV = 1.0f / BASE_SCALE;
  constexpr fm_vec3_t BASE_SCALE_VEC_INV{BASE_SCALE_INV, BASE_SCALE_INV, BASE_SCALE_INV};

  T3DMat4 TMP_MAT{{
    {BASE_SCALE_INV, 0, 0, 0},
    {0, BASE_SCALE_INV, 0, 0},
    {0, 0, BASE_SCALE_INV, 0},
    {0,0,0,1}
  }};

  // compare op for fm_vec3_t
  constexpr bool operator==(const fm_vec3_t &a, const fm_vec3_t &b) {
    return a.x == b.x && a.y == b.y && a.z == b.z;
  }

  constexpr uint32_t hashPos(const fm_vec3_t &pos) {
    return 0x1234 | (((int32_t)pos.x << 20) ^ ((int32_t)pos.y << 10) ^ (int32_t)pos.z);
  }
}

P64::PTX::Sprites::Sprites(const char* spritePath, const Conf &conf_)
  : systems{
    System(conf_.countPerCell), System(conf_.countPerCell),
    System(conf_.countPerCell), System(conf_.countPerCell),
    System(conf_.countPerCell), System(conf_.countPerCell),
  }, conf{conf_}
{
  sprite = sprite_load(spritePath);
  for(auto &s : systems) {
    s.count = 0;
    s.pos = {-999,0,0}; // forces matrix creation for 0,0,0
  }

  rspq_block_begin();
  {
    rdpq_mode_begin();
      if(conf.isRotating) {
        rdpq_mode_filter(FILTER_BILINEAR);
        rdpq_mode_alphacompare(64);
        rdpq_mode_blender(RDPQ_BLENDER_MULTIPLY);
        rdpq_mode_zbuf(true, false);
      } else {
        rdpq_mode_filter(FILTER_POINT);
        rdpq_mode_alphacompare(10);
      }
      rdpq_mode_combiner(RDPQ_COMBINER1((PRIM,0,TEX0,0), (TEX0,0,ENV,0)));
    rdpq_mode_end();

    int shift =  - __builtin_ctz(sprite->height / 8);
    rdpq_texparms_t p{};
    p.s = {.translate = 0, .scale_log = shift, .repeats = REPEAT_INFINITE, .mirror = conf.isRotating != 0};
    p.t = {.translate = 0, .scale_log = shift, .repeats = REPEAT_INFINITE, .mirror = conf.isRotating != 0};
    rdpq_sprite_upload(TILE0, sprite, &p);

    tpx_state_set_scale(1.0f, 1.0f);
  }
  setupDPL = rspq_block_end();
  mirrorPt = 32;
  if(!conf.isRotating)mirrorPt = 0;
}

P64::PTX::Sprites::~Sprites() {
  rspq_block_free(setupDPL);
  sprite_free(sprite);
}

P64::PTX::System *P64::PTX::Sprites::getBySection(const fm_vec3_t &sectionPos, uint32_t posHash) {
  // find existing that is not full...
  for(auto &s : systems) {
    if(s.id == posHash && !s.isFull())return &s;
  }

  // ...or allocate new one + matrix creation
  for(auto &s : systems) {
    if(s.count == 0) {
      s.id = posHash;
      TMP_MAT.m[3][0] = sectionPos.x;
      TMP_MAT.m[3][1] = sectionPos.y;
      TMP_MAT.m[3][2] = sectionPos.z;
      t3d_mat4_to_fixed_3x4(s.mat, &TMP_MAT);
      return &s;
    }
  }
  return nullptr;
}

void P64::PTX::Sprites::add(const fm_vec3_t &pos, uint32_t seed, color_t col, float scale)
{
  fm_vec3_t section = (pos + (127.5f / BASE_SCALE)) / (255.0f / BASE_SCALE);
  section.x = fm_floorf(section.x);
  section.y = fm_floorf(section.y);
  section.z = fm_floorf(section.z);
  section *= (255.0f / BASE_SCALE);

  uint32_t hash = hashPos(section);
  System *sys = getBySection(section, hash);
  if(!sys) {
    //debugf("No space for coins! %08lX: %.2f %.2f %.2f\n", hash, section.x, section.y, section.z);
    return;
  }
  auto posScaled = (pos - section) * BASE_SCALE;

  uint32_t offset = seed;
  if(!conf.noRng) {
    seed = (seed * 23) >> 3;
    offset = (seed * 23) % 7;
    offset *= sprite->height;
  }

  auto p = tpx_buffer_get_pos(sys->particles, sys->count);
  p[0] = (int8_t)posScaled.x;
  p[1] = (int8_t)posScaled.y;
  p[2] = (int8_t)posScaled.z;

  *tpx_buffer_get_size(sys->particles, sys->count) = (int8_t)(scale * 120.0f);

  auto c = tpx_buffer_get_rgba(sys->particles, sys->count);
  c[0] = col.r - (seed & 0b11111);
  c[1] = col.g - (seed & 0b11111);
  c[2] = col.b;
  c[3] = offset;

  ++sys->count;
}

void P64::PTX::Sprites::draw(float deltaTime) {
  animTimer += deltaTime * 15.0f;
  int16_t uvOffset = (int16_t)(animTimer);
  if(uvOffset >= 8)animTimer -= 8.0f;

  rspq_block_run(setupDPL);
  tpx_state_set_tex_params(uvOffset * (1024/sprite->height), mirrorPt);

  for(auto &system : systems) {

    if(system.count % 2 != 0) {
      *tpx_buffer_get_size(system.particles, system.count) = 0;
      ++system.count;
    }
    system.drawTextured();
  }
}

void P64::PTX::Sprites::clear() {
  for(auto &system : systems) {
    system.count = 0;
  }
}

void P64::PTX::Sprites::debugDraw() {
  for(auto &s : systems) {
    if(s.count) {
      fm_vec3_t pos{
        t3d_mat4fp_get_float(s.mat, 3, 0),
        t3d_mat4fp_get_float(s.mat, 3, 1),
        t3d_mat4fp_get_float(s.mat, 3, 2)
      };
      Debug::drawAABB(pos, BASE_SCALE_VEC_INV * 127.5f);
      Debug::drawAABB({pos.x, 0.0f, pos.z}, fm_vec3_t{BASE_SCALE_VEC_INV.x, 0.01f, BASE_SCALE_VEC_INV.z} * 127.5f,
                      {0xFF, 0x00, 0xFF, 0xFF});
    }
  }
}

