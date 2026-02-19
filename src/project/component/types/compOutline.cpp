/**
* @copyright 2025 - Max Bebök
* @license MIT
*
* Outline Component — editor side.
* Configures per-object cartoon outline properties:
*   - color (RGBA)
*   - thickness
*   - enabled flag
*   - outline mode: silhouette only, or full contour
*
* At build time, writes the OutlineConf binary for the N64 engine.
* At edit time, draws a preview gizmo ring around the object.
*/
#include "../components.h"
#include "../../../context.h"
#include "../../../editor/imgui/helper.h"
#include "../../../utils/json.h"
#include "../../../utils/jsonBuilder.h"
#include "../../../utils/binaryFile.h"
#include "../../../utils/logger.h"
#include "../../../editor/pages/parts/viewport3D.h"
#include "../../../renderer/scene.h"
#include "../../../utils/meshGen.h"

namespace
{
  constexpr int OUTLINE_MODE_SILHOUETTE = 0;
  constexpr int OUTLINE_MODE_CONTOUR    = 1;
  constexpr int OUTLINE_MODE_COUNT      = 2;

  constexpr const char* const OUTLINE_MODES[OUTLINE_MODE_COUNT] = {
    "Silhouette (Back-Face Hull)",
    "Full Contour",
  };
}

namespace Project::Component::Outline
{
  struct Data
  {
    PROP_VEC4(color);      // outline color (RGBA), default: (0,0,0,1) = opaque black
    PROP_FLOAT(thickness); // expansion in model-space units
    PROP_S32(mode);        // 0=silhouette, 1=contour
    PROP_BOOL(enabled);    // toggle at scene level
  };

  std::shared_ptr<void> init(Object &obj) {
    auto data = std::make_shared<Data>();
    data->color.value   = {0.0f, 0.0f, 0.0f, 1.0f};
    data->thickness.value = 1.5f;
    data->mode.value    = OUTLINE_MODE_SILHOUETTE;
    data->enabled.value = true;
    return data;
  }

  nlohmann::json serialize(const Entry &entry) {
    Data &data = *static_cast<Data*>(entry.data.get());
    Utils::JSON::Builder builder{};
    builder.set(data.color);
    builder.set(data.thickness);
    builder.set(data.mode);
    builder.set(data.enabled);
    return builder.doc;
  }

  std::shared_ptr<void> deserialize(nlohmann::json &doc) {
    auto data = std::make_shared<Data>();
    Utils::JSON::readProp(doc, data->color);
    Utils::JSON::readProp(doc, data->thickness);
    Utils::JSON::readProp(doc, data->mode);
    Utils::JSON::readProp(doc, data->enabled);
    return data;
  }

  void build(Object& obj, Entry &entry, Build::SceneCtx &ctx)
  {
    Data &data = *static_cast<Data*>(entry.data.get());

    // Write binary outline config matching the N64 OutlineConf struct layout:
    //   color_t  color;       // 4 bytes RGBA
    //   float    thickness;   // 4 bytes
    //   uint8_t  mode;        // 1 byte
    //   uint8_t  enabled;     // 1 byte
    //   uint16_t padding;     // 2 bytes (alignment)

    ctx.fileObj.writeRGBA(data.color.resolve(obj.propOverrides));
    ctx.fileObj.writeFloat(data.thickness.resolve(obj.propOverrides));
    ctx.fileObj.write<uint8_t>(data.mode.resolve(obj.propOverrides));
    ctx.fileObj.write<uint8_t>(data.enabled.resolve(obj.propOverrides) ? 1 : 0);
    ctx.fileObj.write<uint16_t>(0); // padding
  }

  void update(Object &obj, Entry &entry)
  {
    // No per-frame editor logic needed; the outline is purely visual
  }

  void draw(Object &obj, Entry &entry)
  {
    Data &data = *static_cast<Data*>(entry.data.get());

    if (ImTable::start("Comp", &obj))
    {
      ImTable::add("Name", entry.name);
      ImTable::addColor("Color", data.color.value, true);
      ImTable::add("Thickness", data.thickness.value);
      ImTable::addComboBox("Mode", data.mode.value, OUTLINE_MODES, OUTLINE_MODE_COUNT);
      ImTable::add("Enabled", data.enabled.value);
      ImTable::end();
    }
  }

  void draw3D(Object& obj, Entry &entry, Editor::Viewport3D &vp,
              SDL_GPUCommandBuffer* cmdBuff, SDL_GPURenderPass* pass)
  {
    Data &data = *static_cast<Data*>(entry.data.get());

    if (!data.enabled.resolve(obj.propOverrides)) return;

    bool isSelected = ctx.selObjectUUID == obj.uuid;
    if (!isSelected) return;

    // Draw a wire-box slightly larger than the object to preview outline extent
    auto pos  = obj.pos.resolve(obj.propOverrides);
    float t   = data.thickness.resolve(obj.propOverrides);
    glm::vec4 col4 = data.color.resolve(obj.propOverrides);
    glm::u8vec4 col = glm::u8vec4(col4 * 255.0f);

    float ext = 0.5f + t * 0.1f; // rough preview size
    Utils::Mesh::addLineBox(*vp.getLines(), pos, {ext, ext, ext}, col);
  }
}
