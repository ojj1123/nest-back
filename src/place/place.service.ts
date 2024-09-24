import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JWT } from 'next-auth/jwt';
import { IPlace } from './entity/place.entity';

export default class PlaceService {
  private token: JWT;
  constructor(
    @InjectModel('Place') private Place: Model<IPlace>,
    token?: JWT,
  ) {
    this.token = token as JWT;
  }
  async getActivePlace(status: 'active' | 'inactive') {
    try {
      const places = await this.Place.find({ status });
      return places;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async addPlace(placeData: IPlace) {
    try {
      const {
        status,
        fullname,
        brand,
        branch,
        image,
        latitude,
        longitude,
        location,
        coverImage,
        locationDetail,
        time,
        registerDate,
        registrant,
        mapURL,
      } = placeData;

      if (!time) placeData.time = 'unknown';
      if (!registerDate) placeData.registerDate = new Date().toString();
      placeData.status = 'inactive';
      placeData.registrant = this.token.id as string;

      if (
        !fullname ||
        !brand ||
        !branch ||
        !image ||
        !latitude ||
        !longitude ||
        !location ||
        !coverImage ||
        !locationDetail ||
        !mapURL
      )
        throw new ValidationError(
          `fullname ||brand ||branch ||image ||latitude ||longitude ||location ||coverImage ||locationDetail ||mapURL not exist`,
        );

      const validatedPlace = PlaceZodSchema.parse(placeData);
      await this.Place.create(validatedPlace);
      return;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  async updateStatus(placeId: any, status: any) {
    const statusList = ['active', 'inactive'];

    if (!statusList.includes(status)) throw new ValidationError('wrong status');

    const updated = await this.Place.updateOne({ _id: placeId }, { status });
    if (!updated.modifiedCount) throw new DatabaseError('update failed');

    return;
  }
}
